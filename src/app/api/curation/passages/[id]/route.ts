import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const reviewSchema = z.object({ reviewNote: z.string().trim().min(10).max(1000) });

export async function PATCH(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "مراجعة المقاطع متاحة لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }
    const { id } = await route.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف المقطع غير صالح" }, { status: 400, headers: NO_STORE });
    const body = await readJsonBody(request, 4096);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = reviewSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "أدخل ملاحظة توضح ما الذي طابقته مع المصدر" }, { status: 400, headers: NO_STORE });

    const result = await prisma.$transaction(async tx => {
      const passage = await tx.evidencePassage.findUnique({
        where: { id },
        select: { id: true, sourceId: true, reviewedByHuman: true, source: { select: { humanReviewed: true, accessStatus: true } } }
      });
      if (!passage) return { error: "المقطع غير موجود", status: 404 } as const;
      if (!passage.source.humanReviewed || passage.source.accessStatus === "NOT_CHECKED") {
        return { error: "راجع بيانات المصدر وإتاحته أولًا", status: 409 } as const;
      }
      if (passage.reviewedByHuman) return { error: "تمت مراجعة هذا المقطع سابقًا", status: 409 } as const;
      const update = await tx.evidencePassage.updateMany({
        where: { id, reviewedByHuman: false },
        data: { reviewedByHuman: true, reviewNote: parsed.data.reviewNote }
      });
      if (update.count !== 1) throw new Error("PASSAGE_ALREADY_REVIEWED");
      const saved = await tx.evidencePassage.findUniqueOrThrow({
        where: { id },
        select: { id: true, sourceId: true, pageLabel: true, locator: true, reviewedByHuman: true, reviewNote: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "CATALOGUE_PASSAGE_REVIEWED",
          targetType: "EvidencePassage",
          targetId: id,
          details: JSON.stringify({ sourceId: passage.sourceId, reviewNote: parsed.data.reviewNote })
        }
      });
      return { data: saved } as const;
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ data: result.data, message: "تم توثيق مراجعة المقطع مع ملاحظة بشرية." }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof Error && error.message === "PASSAGE_ALREADY_REVIEWED") {
      return NextResponse.json({ error: "تمت مراجعة المقطع بطلب آخر" }, { status: 409, headers: NO_STORE });
    }
    console.error("Catalogue passage review failed", error);
    return NextResponse.json({ error: "تعذرت مراجعة المقطع" }, { status: 503, headers: NO_STORE });
  }
}
