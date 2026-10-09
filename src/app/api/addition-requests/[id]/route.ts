import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const reviewSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  reviewerNote: z.string().trim().max(2000).optional().or(z.literal(""))
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(workspace.role, "REVIEWER")) {
      return NextResponse.json({ error: "تحتاج إلى صلاحية مراجع" }, { status: 403, headers: NO_STORE });
    }

    const { id } = await context.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف الطلب غير صالح" }, { status: 400, headers: NO_STORE });

    const body = await readJsonBody(request, 4096);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = reviewSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "حالة المراجعة أو الملاحظة غير صالحة" }, { status: 400, headers: NO_STORE });

    const result = await prisma.$transaction(async tx => {
      const update = await tx.additionRequest.updateMany({
        where: { id, workspaceId: workspace.workspaceId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        data: { status: parsed.data.status, reviewerNote: parsed.data.reviewerNote || null }
      });
      if (update.count !== 1) return null;

      const item = await tx.additionRequest.findFirst({
        where: { id, workspaceId: workspace.workspaceId },
        select: { id: true, proposedName: true, status: true, reviewerNote: true }
      });
      if (!item) return null;

      await tx.auditLog.create({
        data: {
          workspaceId: workspace.workspaceId,
          actorUserId: workspace.user.id,
          actor: workspace.user.email,
          action: "ADDITION_REQUEST_REVIEWED",
          targetType: "AdditionRequest",
          targetId: item.id,
          details: JSON.stringify({ status: item.status })
        }
      });
      return item;
    });

    if (!result) {
      return NextResponse.json({ error: "الطلب غير موجود في مساحة العمل أو أُغلقت مراجعته مسبقًا" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ data: result }, { headers: NO_STORE });
  } catch (error) {
    console.error("Addition request review failed", error);
    return NextResponse.json({ error: "تعذر حفظ قرار المراجعة" }, { status: 503, headers: NO_STORE });
  }
}
