import { NextRequest, NextResponse } from "next/server";
import { additionRequestSchema } from "@/lib/addition-request";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { safeExternalHttpUrl } from "@/lib/safe-url";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    const requests = await prisma.additionRequest.findMany({
      where: { workspaceId: context.workspaceId, userId: context.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, proposedName: true, proposedKind: true, explanation: true,
        sourceUrl: true, status: true, reviewerNote: true, createdAt: true
      }
    });
    return NextResponse.json({ data: requests }, { headers: NO_STORE });
  } catch (error) {
    console.error("Addition request listing failed", error);
    return NextResponse.json({ error: "تعذر تحميل طلبات الإضافة" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });

    const body = await readJsonBody(request, 8192);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    }

    const parsed = additionRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "تحقق من الاسم ونوع الكيان والتفسير (10 إلى 3000 حرف)" }, { status: 400, headers: NO_STORE });
    }

    const input = parsed.data;
    const sourceUrl = input.sourceUrl ? safeExternalHttpUrl(input.sourceUrl) : null;
    if (input.sourceUrl && !sourceUrl) {
      return NextResponse.json({ error: "رابط المصدر يجب أن يكون HTTP أو HTTPS صالحًا ومن دون بيانات دخول" }, { status: 400, headers: NO_STORE });
    }

    const created = await prisma.$transaction(async tx => {
      const item = await tx.additionRequest.create({
        data: {
          workspaceId: context.workspaceId,
          userId: context.user.id,
          proposedName: input.proposedName,
          proposedKind: input.proposedKind,
          explanation: input.explanation,
          sourceUrl,
          submitter: context.user.email,
          status: "SUBMITTED"
        },
        select: { id: true, proposedName: true, proposedKind: true, status: true, createdAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "ADDITION_REQUEST_SUBMITTED",
          targetType: "AdditionRequest",
          targetId: item.id,
          details: JSON.stringify({ proposedKind: item.proposedKind })
        }
      });
      return item;
    });

    return NextResponse.json({ data: created, message: "تم حفظ الطلب في مساحة العمل، ولم يُنشر في الكتالوج المشترك." }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Addition request submission failed", error);
    return NextResponse.json({ error: "تعذر حفظ الطلب حاليًا" }, { status: 503, headers: NO_STORE });
  }
}
