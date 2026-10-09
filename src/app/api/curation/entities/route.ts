import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";
import { normalizeName } from "@/lib/validation";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  kind: z.enum(["TRIBE", "CLAN", "FAMILY"]),
  passageId: z.string().min(1).max(64)
});

function normalizedText(value: string) {
  return normalizeName(value).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function sourceContainsName(passageText: string, name: string) {
  const haystack = ` ${normalizedText(passageText)} `;
  const needle = ` ${normalizedText(name)} `;
  return needle.trim().length > 0 && haystack.includes(needle);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "إنشاء الكيانات متاح لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }
    const body = await readJsonBody(request, 4096);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "أدخل اسمًا ونوعًا ومعرّف مقطع صالحًا" }, { status: 400, headers: NO_STORE });

    const normalizedName = normalizeName(parsed.data.name);
    if (!normalizedName) return NextResponse.json({ error: "الاسم غير صالح" }, { status: 400, headers: NO_STORE });

    const result = await prisma.$transaction(async tx => {
      const passage = await tx.evidencePassage.findUnique({
        where: { id: parsed.data.passageId },
        select: {
          id: true,
          passageText: true,
          entityId: true,
          reviewedByHuman: true,
          source: { select: { id: true, title: true, humanReviewed: true, accessStatus: true } }
        }
      });
      if (!passage) return { error: "مقطع المصدر غير موجود", status: 404 } as const;
      if (!passage.source.humanReviewed || passage.source.accessStatus === "NOT_CHECKED" || !passage.reviewedByHuman) {
        return { error: "لا يمكن إنشاء كيان قبل مراجعة بيانات المصدر ومقطع النص بشريًا", status: 409 } as const;
      }
      if (passage.entityId) return { error: "هذا المقطع مرتبط بكيان آخر بالفعل", status: 409 } as const;
      if (!sourceContainsName(passage.passageText, parsed.data.name)) {
        return { error: "الاسم لا يظهر كنص مستقل داخل المقطع المراجع؛ لم يُنشأ أي سجل", status: 422 } as const;
      }
      const duplicate = await tx.tribalEntity.findUnique({
        where: { normalizedName },
        select: { id: true, name: true }
      });
      if (duplicate) return { error: "يوجد سجل بهذا الاسم أو بصيغته المعيارية بالفعل", status: 409 } as const;

      const entity = await tx.tribalEntity.create({
        data: { name: parsed.data.name, normalizedName, kind: parsed.data.kind, summary: null },
        select: { id: true, name: true, kind: true, summary: true, createdAt: true }
      });
      const linked = await tx.evidencePassage.updateMany({
        where: { id: passage.id, entityId: null, reviewedByHuman: true },
        data: { entityId: entity.id }
      });
      if (linked.count !== 1) throw new Error("PASSAGE_ALREADY_LINKED");

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "CATALOGUE_ENTITY_CREATED_FROM_REVIEWED_PASSAGE",
          targetType: "TribalEntity",
          targetId: entity.id,
          details: JSON.stringify({ passageId: passage.id, sourceId: passage.source.id, kind: entity.kind, summary: null })
        }
      });
      return { data: { entity, sourceTitle: passage.source.title, passageId: passage.id } } as const;
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ data: result.data, message: "أُنشئ سجل الكيان وربط بالمقطع المراجع. لم يُنشأ ادعاء نسب أو ملخص تاريخي تلقائيًا." }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof Error && error.message === "PASSAGE_ALREADY_LINKED") {
      return NextResponse.json({ error: "ارتبط المقطع بكيان آخر أثناء العملية؛ حدّث الصفحة" }, { status: 409, headers: NO_STORE });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "يوجد سجل بهذا الاسم بالفعل" }, { status: 409, headers: NO_STORE });
    }
    console.error("Curated entity creation failed", error);
    return NextResponse.json({ error: "تعذر إنشاء سجل الكيان" }, { status: 503, headers: NO_STORE });
  }
}
