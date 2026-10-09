import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const reviewSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "SUPPORTED", "DISPUTED", "REJECTED"]),
  reviewerNote: z.string().trim().min(10).max(1000)
});

export async function PATCH(request: NextRequest, routeParams: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "مراجعة الادعاءات متاحة لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }

    const { id } = await routeParams.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف الادعاء غير صالح" }, { status: 400, headers: NO_STORE });
    const body = await readJsonBody(request, 4096);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = reviewSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "اختر حالة مراجعة وأدخل ملاحظة لا تقل عن عشرة أحرف" }, { status: 400, headers: NO_STORE });

    const result = await prisma.$transaction(async tx => {
      const claim = await tx.historicalClaim.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          supportingPassages: { where: { reviewedByHuman: true }, select: { id: true } },
          contradictingPassages: { where: { reviewedByHuman: true }, select: { id: true } }
        }
      });
      if (!claim) return { error: "الادعاء غير موجود", status: 404 } as const;
      if (parsed.data.status === "SUPPORTED" && claim.supportingPassages.length === 0) {
        return { error: "لا يمكن اعتماد الدعم دون مقطع مؤيد مراجع بشريًا", status: 409 } as const;
      }
      if (parsed.data.status === "DISPUTED" && claim.contradictingPassages.length === 0) {
        return { error: "لا يمكن تصنيف الادعاء متعارضًا دون مقطع مناقض مراجع بشريًا", status: 409 } as const;
      }

      const updated = await tx.historicalClaim.update({
        where: { id },
        data: {
          status: parsed.data.status,
          reviewedByHuman: true,
          reviewedAt: new Date(),
          reviewerNote: parsed.data.reviewerNote
        },
        select: { id: true, status: true, reviewedByHuman: true, reviewedAt: true, reviewerNote: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "HISTORICAL_CLAIM_REVIEWED",
          targetType: "HistoricalClaim",
          targetId: id,
          details: JSON.stringify({ previousStatus: claim.status, status: updated.status, reviewerNote: parsed.data.reviewerNote })
        }
      });
      return { data: updated } as const;
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ data: result.data, message: "حُفظ قرار المراجعة مع الملاحظة البشرية." }, { headers: NO_STORE });
  } catch (error) {
    console.error("Historical claim review failed", error);
    return NextResponse.json({ error: "تعذرت مراجعة الادعاء" }, { status: 503, headers: NO_STORE });
  }
}
