import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

const createSchema = z.object({
  statement: z.string().trim().min(8).max(2000),
  sourceId: z.string().min(1).max(64),
  entityId: z.string().max(64).optional().nullable(),
  supportingPassageIds: z.array(z.string().min(1).max(64)).max(20).default([]),
  contradictingPassageIds: z.array(z.string().min(1).max(64)).max(20).default([]),
  reviewerNote: z.string().trim().max(1000).optional().default("")
}).superRefine((value, ctx) => {
  const allIds = [...value.supportingPassageIds, ...value.contradictingPassageIds];
  if (allIds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["supportingPassageIds"], message: "أرفق مقطع دليل واحدًا على الأقل" });
  }
  if (new Set(allIds).size !== allIds.length) {
    ctx.addIssue({ code: "custom", path: ["supportingPassageIds"], message: "لا تكرر المقطع نفسه في أكثر من تصنيف" });
  }
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "إنشاء الادعاءات متاح لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 12_000);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "أدخل نص الادعاء وأرفق مقطع دليل مراجعًا واحدًا على الأقل" }, { status: 400, headers: NO_STORE });

    const input = parsed.data;
    const passageIds = [...input.supportingPassageIds, ...input.contradictingPassageIds];
    const result = await prisma.$transaction(async tx => {
      const source = await tx.source.findUnique({
        where: { id: input.sourceId },
        select: { id: true, title: true, humanReviewed: true, accessStatus: true }
      });
      if (!source) return { error: "المصدر غير موجود", status: 404 } as const;
      if (!source.humanReviewed || source.accessStatus === "NOT_CHECKED") {
        return { error: "راجع بيانات المصدر وإتاحته بشريًا قبل إنشاء الادعاء", status: 409 } as const;
      }

      const passages = await tx.evidencePassage.findMany({
        where: { id: { in: passageIds }, sourceId: input.sourceId, reviewedByHuman: true },
        select: { id: true, sourceId: true, reviewedByHuman: true }
      });
      if (passages.length !== passageIds.length) {
        return { error: "كل مقطع مختار يجب أن يكون من المصدر نفسه ومراجعًا بشريًا", status: 409 } as const;
      }

      if (input.entityId) {
        const entity = await tx.tribalEntity.findUnique({ where: { id: input.entityId }, select: { id: true } });
        if (!entity) return { error: "الكيان المحدد غير موجود", status: 404 } as const;
      }

      const claim = await tx.historicalClaim.create({
        data: {
          statement: input.statement,
          status: "UNREVIEWED",
          reviewedByHuman: false,
          sourceId: source.id,
          entityId: input.entityId || null,
          confidenceNote: input.reviewerNote || null,
          supportingPassages: { connect: input.supportingPassageIds.map(id => ({ id })) },
          contradictingPassages: { connect: input.contradictingPassageIds.map(id => ({ id })) }
        },
        select: { id: true, statement: true, status: true, createdAt: true }
      });

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "HISTORICAL_CLAIM_CREATED_FROM_REVIEWED_EVIDENCE",
          targetType: "HistoricalClaim",
          targetId: claim.id,
          details: JSON.stringify({
            sourceId: source.id,
            supportingPassageIds: input.supportingPassageIds,
            contradictingPassageIds: input.contradictingPassageIds,
            entityId: input.entityId || null
          })
        }
      });
      return { data: claim } as const;
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ data: result.data, message: "سُجل الادعاء بحالة غير مراجع؛ لم يُعتمد كحقيقة." }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Historical claim creation failed", error);
    return NextResponse.json({ error: "تعذر تسجيل الادعاء" }, { status: 503, headers: NO_STORE });
  }
}
