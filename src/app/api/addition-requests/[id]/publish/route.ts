import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { normalizeName } from "@/lib/validation";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (workspace.role !== "OWNER") {
      return NextResponse.json({ error: "نشر السجلات المشتركة متاح لمالك مساحة العمل فقط" }, { status: 403, headers: NO_STORE });
    }

    const { id } = await context.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف الطلب غير صالح" }, { status: 400, headers: NO_STORE });

    const outcome = await prisma.$transaction(async tx => {
      const proposal = await tx.additionRequest.findFirst({
        where: { id, workspaceId: workspace.workspaceId, status: "APPROVED" },
        select: { id: true, entityId: true, proposedName: true, proposedKind: true, explanation: true, sourceUrl: true }
      });
      if (!proposal) return { kind: "NOT_APPROVED" as const };
      if (proposal.entityId) {
        const existing = await tx.tribalEntity.findUnique({ where: { id: proposal.entityId }, select: { id: true, name: true } });
        return existing ? { kind: "ALREADY_PUBLISHED" as const, entity: existing } : { kind: "CONFLICT" as const };
      }

      const normalizedName = normalizeName(proposal.proposedName);
      const duplicate = await tx.tribalEntity.findUnique({ where: { normalizedName }, select: { id: true, name: true } });
      if (duplicate) return { kind: "DUPLICATE" as const, entity: duplicate };

      const entity = await tx.tribalEntity.create({
        data: {
          name: proposal.proposedName,
          normalizedName,
          kind: proposal.proposedKind,
          summary: proposal.explanation
        },
        select: { id: true, name: true, kind: true }
      });

      await tx.additionRequest.update({
        where: { id: proposal.id },
        data: { entityId: entity.id }
      });

      await tx.auditLog.create({
        data: {
          workspaceId: workspace.workspaceId,
          actorUserId: workspace.user.id,
          actor: workspace.user.email,
          action: "APPROVED_ENTITY_PUBLISHED_TO_SHARED_CATALOGUE",
          targetType: "TribalEntity",
          targetId: entity.id,
          details: JSON.stringify({ requestId: proposal.id, sourceUrl: proposal.sourceUrl })
        }
      });
      return { kind: "PUBLISHED" as const, entity };
    });

    if (outcome.kind === "NOT_APPROVED") {
      return NextResponse.json({ error: "الطلب غير موجود أو لم تتم الموافقة عليه بعد" }, { status: 409, headers: NO_STORE });
    }
    if (outcome.kind === "DUPLICATE") {
      return NextResponse.json({ error: "يوجد كيان بالاسم الموحّد نفسه في الكتالوج. راجع السجل الموجود بدل إنشاء نسخة مكررة.", existing: outcome.entity }, { status: 409, headers: NO_STORE });
    }
    if (outcome.kind === "CONFLICT") {
      return NextResponse.json({ error: "حالة الطلب غير متسقة؛ أوقفنا النشر للمراجعة الإدارية." }, { status: 409, headers: NO_STORE });
    }

    return NextResponse.json({
      data: outcome.entity,
      message: outcome.kind === "PUBLISHED" ? "نُشر الكيان في الكتالوج المشترك وسُجلت العملية." : "هذا الطلب مرتبط بالفعل بكيان منشور."
    }, { status: outcome.kind === "PUBLISHED" ? 201 : 200, headers: NO_STORE });
  } catch (error) {
    console.error("Approved entity publication failed", error);
    return NextResponse.json({ error: "تعذر نشر الكيان حاليًا" }, { status: 503, headers: NO_STORE });
  }
}
