import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const createSchema = z.object({
  fromEntityId: z.string().min(1).max(64),
  toEntityId: z.string().min(1).max(64),
  relationshipType: z.enum(["BRANCH_OF", "RELATED_TO", "PARENT_OF", "CHILD_OF", "SIBLING_OF", "SPOUSE_OF", "LOCATED_IN", "OTHER"]),
  claimId: z.string().min(1).max(64),
  description: z.string().trim().min(10).max(1000)
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "إضافة العلاقات متاحة لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 6000);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "أكمل الطرفين ونوع العلاقة والادعاء المراجع وسبب الربط" }, { status: 400, headers: NO_STORE });
    if (parsed.data.fromEntityId === parsed.data.toEntityId) {
      return NextResponse.json({ error: "لا يمكن ربط الكيان بنفسه" }, { status: 422, headers: NO_STORE });
    }

    const result = await prisma.$transaction(async tx => {
      const [fromEntity, toEntity, claim] = await Promise.all([
        tx.tribalEntity.findUnique({ where: { id: parsed.data.fromEntityId }, select: { id: true, name: true } }),
        tx.tribalEntity.findUnique({ where: { id: parsed.data.toEntityId }, select: { id: true, name: true } }),
        tx.historicalClaim.findUnique({
          where: { id: parsed.data.claimId },
          select: {
            id: true, entityId: true, status: true, reviewedByHuman: true, statement: true,
            supportingPassages: { where: { reviewedByHuman: true }, select: { id: true } }
          }
        })
      ]);
      if (!fromEntity || !toEntity) return { error: "أحد الكيانين غير موجود", status: 404 } as const;
      if (!claim) return { error: "الادعاء المرتبط غير موجود", status: 404 } as const;
      if (claim.entityId !== fromEntity.id || claim.status !== "SUPPORTED" || !claim.reviewedByHuman || claim.supportingPassages.length === 0) {
        return { error: "يجب ربط العلاقة بادعاء معتمد بشريًا ومدعوم بمقطع مراجع مرتبط بالكيان الحالي", status: 409 } as const;
      }

      const duplicate = await tx.relationship.findFirst({
        where: {
          fromEntityId: fromEntity.id,
          toEntityId: toEntity.id,
          relationshipType: parsed.data.relationshipType
        },
        select: { id: true }
      });
      if (duplicate) return { error: "هذه العلاقة مسجلة بالفعل", status: 409 } as const;

      const relationship = await tx.relationship.create({
        data: {
          fromEntityId: fromEntity.id,
          toEntityId: toEntity.id,
          relationshipType: parsed.data.relationshipType,
          description: parsed.data.description,
          claimId: claim.id
        },
        select: { id: true, relationshipType: true, description: true, claimId: true, createdAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "EVIDENCE_LINKED_RELATIONSHIP_CREATED",
          targetType: "Relationship",
          targetId: relationship.id,
          details: JSON.stringify({
            fromEntityId: fromEntity.id, toEntityId: toEntity.id,
            relationshipType: relationship.relationshipType, claimId: claim.id
          })
        }
      });
      return { data: relationship } as const;
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ data: result.data, message: "سُجلت العلاقة وربطت بادعاء مراجع؛ افحص المصدر قبل الاستنتاج." }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Evidence-linked relationship creation failed", error);
    return NextResponse.json({ error: "تعذر تسجيل العلاقة" }, { status: 503, headers: NO_STORE });
  }
}
