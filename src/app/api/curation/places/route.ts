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
  country: z.string().trim().max(120).optional().nullable(),
  region: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  passageId: z.string().min(1).max(64),
  entityId: z.string().min(1).max(64).optional().nullable()
});

function normalizedText(value: string) {
  return normalizeName(value).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function passageContainsName(passageText: string, name: string) {
  const haystack = " " + normalizedText(passageText) + " ";
  const needle = " " + normalizedText(name) + " ";
  return needle.trim().length > 0 && haystack.includes(needle);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "إضافة الأماكن متاحة لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 8000);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "أدخل اسم المكان ومقطع مصدر مراجعًا، وتحقق من الإحداثيات إن أُضيفت" }, { status: 400, headers: NO_STORE });

    const result = await prisma.$transaction(async tx => {
      const passage = await tx.evidencePassage.findUnique({
        where: { id: parsed.data.passageId },
        select: {
          id: true, sourceId: true, pageLabel: true, locator: true, passageText: true, reviewedByHuman: true,
          source: { select: { id: true, title: true, humanReviewed: true, accessStatus: true } }
        }
      });
      if (!passage) return { error: "مقطع المصدر غير موجود", status: 404 } as const;
      if (!passage.reviewedByHuman || !passage.source.humanReviewed || passage.source.accessStatus === "NOT_CHECKED") {
        return { error: "راجع المصدر ومقطع النص بشريًا قبل تسجيل المكان", status: 409 } as const;
      }
      if (!passageContainsName(passage.passageText, parsed.data.name)) {
        return { error: "اسم المكان لا يظهر كنص مستقل داخل المقطع المراجع؛ لم يُنشأ أي سجل", status: 422 } as const;
      }

      if (parsed.data.entityId) {
        const entity = await tx.tribalEntity.findUnique({ where: { id: parsed.data.entityId }, select: { id: true } });
        if (!entity) return { error: "الكيان المحدد غير موجود", status: 404 } as const;
      }

      const duplicate = await tx.place.findFirst({
        where: {
          name: parsed.data.name,
          country: parsed.data.country || null,
          region: parsed.data.region || null
        },
        select: { id: true, name: true }
      });
      if (duplicate) return { error: "يوجد سجل مكان مطابق بالاسم والدولة والمنطقة", status: 409 } as const;

      const sourceNote = "المصدر: " + passage.source.title + "؛ الموضع: " + (passage.pageLabel || passage.locator || "غير محدد");
      const place = await tx.place.create({
        data: {
          name: parsed.data.name,
          country: parsed.data.country || null,
          region: parsed.data.region || null,
          description: parsed.data.description || null,
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
          sourceNote,
          sourceId: passage.sourceId,
          evidencePassageId: passage.id,
          entityId: parsed.data.entityId || null
        },
        select: { id: true, name: true, country: true, region: true, sourceId: true, evidencePassageId: true, entityId: true, createdAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "PLACE_CREATED_FROM_REVIEWED_EVIDENCE",
          targetType: "Place",
          targetId: place.id,
          details: JSON.stringify({ sourceId: passage.sourceId, passageId: passage.id, entityId: place.entityId, name: place.name })
        }
      });
      return { data: place } as const;
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ data: result.data, message: "سُجل المكان وربط بمقطع مصدر مراجع. ربطه بالكيان اختياري، ولم تُستنتج إحداثيات غير مدخلة." }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Place creation from evidence failed", error);
    return NextResponse.json({ error: "تعذر تسجيل المكان" }, { status: 503, headers: NO_STORE });
  }
}
