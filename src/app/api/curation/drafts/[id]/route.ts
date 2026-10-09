import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";
import { z } from "zod";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const decisionSchema = z.object({
  decision: z.enum(["APPROVE_DRAFT", "REJECT_DRAFT"]),
  reviewNote: z.string().trim().max(1000).optional().or(z.literal(""))
});

export async function PATCH(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") ||
        !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "هذه العملية متاحة لأمين كتالوج معتمد فقط." }, { status: 403, headers: NO_STORE });
    }

    const { id } = await route.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف المسودة غير صالح" }, { status: 400, headers: NO_STORE });
    const body = await readJsonBody(request, 4096);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = decisionSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "قرار المراجعة غير صالح" }, { status: 400, headers: NO_STORE });

    const suggestion = await prisma.researchSuggestion.findFirst({
      where: { id, workspaceId: context.workspaceId },
      select: {
        id: true, workspaceId: true, sourceId: true, passageId: true,
        statement: true, evidenceQuote: true, status: true,
        passage: { select: { passageText: true, entityId: true } }
      }
    });
    if (!suggestion) return NextResponse.json({ error: "المسودة غير موجودة في مساحة العمل الحالية" }, { status: 404, headers: NO_STORE });
    if (suggestion.status !== "PENDING") return NextResponse.json({ error: "تمت مراجعة هذه المسودة سابقًا" }, { status: 409, headers: NO_STORE });
    if (parsed.data.decision === "APPROVE_DRAFT" && !suggestion.passage.passageText.includes(suggestion.evidenceQuote)) {
      return NextResponse.json({ error: "تعذر مطابقة الاقتباس مع نص المصدر؛ لم يتم اعتماد المسودة." }, { status: 409, headers: NO_STORE });
    }

    const result = await prisma.$transaction(async tx => {
      // Compare-and-set the pending state so two simultaneous review requests
      // cannot create two claims from the same draft.
      const updatedCount = await tx.researchSuggestion.updateMany({
        where: { id: suggestion.id, workspaceId: context.workspaceId, status: "PENDING" },
        data: {
          status: parsed.data.decision === "APPROVE_DRAFT" ? "ACCEPTED_AS_CLAIM" : "REJECTED",
          reviewedAt: new Date(),
          reviewedBy: context.user.email,
          reviewNote: parsed.data.reviewNote || null
        }
      });
      if (updatedCount.count !== 1) throw new Error("DRAFT_ALREADY_REVIEWED");

      let claimId: string | null = null;
      if (parsed.data.decision === "APPROVE_DRAFT") {
        const claim = await tx.historicalClaim.create({
          data: {
            statement: suggestion.statement,
            status: "UNREVIEWED",
            reviewedByHuman: false,
            sourceId: suggestion.sourceId,
            entityId: suggestion.passage.entityId,
            supportingPassages: { connect: { id: suggestion.passageId } }
          },
          select: { id: true, statement: true, status: true }
        });
        claimId = claim.id;
      }
      const updated = await tx.researchSuggestion.findUniqueOrThrow({
        where: { id: suggestion.id },
        select: { id: true, status: true, reviewedAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: parsed.data.decision === "APPROVE_DRAFT" ? "CATALOGUE_DRAFT_ACCEPTED_AS_UNREVIEWED_CLAIM" : "CATALOGUE_DRAFT_REJECTED",
          targetType: "ResearchSuggestion",
          targetId: suggestion.id,
          details: JSON.stringify({ claimId, reviewNote: parsed.data.reviewNote || null })
        }
      });
      return { suggestion: updated, claimId };
    });

    return NextResponse.json({
      data: result,
      message: parsed.data.decision === "APPROVE_DRAFT"
        ? "أُضيف الادعاء إلى السجل بحالة غير مراجع. لم يُعلن ثبوته."
        : "رُفضت المسودة وسُجل قرار المراجعة."
    }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof Error && error.message === "DRAFT_ALREADY_REVIEWED") {
      return NextResponse.json({ error: "تمت مراجعة هذه المسودة بواسطة طلب آخر؛ حدّث الصفحة." }, { status: 409, headers: NO_STORE });
    }
    console.error("Catalogue draft review failed", error);
    return NextResponse.json({ error: "تعذرت معالجة قرار المراجعة حاليًا." }, { status: 503, headers: NO_STORE });
  }
}
