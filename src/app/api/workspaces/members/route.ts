import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const memberSchema = z.object({ email: z.string().trim().email().max(254) });

export async function GET(request: NextRequest) {
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "اختر مجلسًا أولًا" }, { status: 401, headers: NO_STORE });
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true, image: true } } }
    });
    return NextResponse.json({ data: { workspace: workspace.workspace, members } }, { headers: NO_STORE });
  } catch (error) {
    console.error("Council member list failed", error);
    return NextResponse.json({ error: "تعذر تحميل أعضاء المجلس" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "اختر مجلسًا أولًا" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(workspace.role, "EDITOR")) return NextResponse.json({ error: "إضافة الأعضاء متاحة لمالك المجلس أو محرره" }, { status: 403, headers: NO_STORE });

    const body = await readJsonBody(request, 2048);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = memberSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "أدخل بريدًا إلكترونيًا صالحًا" }, { status: 400, headers: NO_STORE });
    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, image: true } });
    if (!user) return NextResponse.json({ error: "لم نجد حسابًا بهذا البريد. يجب على الشخص إنشاء حساب أولًا." }, { status: 404, headers: NO_STORE });
    if (user.id === workspace.user.id) return NextResponse.json({ error: "أنت عضو في هذا المجلس بالفعل" }, { status: 409, headers: NO_STORE });

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.workspaceId, userId: user.id } },
      select: { id: true }
    });
    if (existing) return NextResponse.json({ error: "هذا الحساب عضو بالفعل في المجلس" }, { status: 409, headers: NO_STORE });

    const member = await prisma.$transaction(async tx => {
      const created = await tx.workspaceMember.create({
        data: { workspaceId: workspace.workspaceId, userId: user.id, role: "VIEWER" },
        select: { id: true, role: true, createdAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: workspace.workspaceId,
          actorUserId: workspace.user.id,
          actor: workspace.user.email,
          action: "COUNCIL_MEMBER_ADDED",
          targetType: "WorkspaceMember",
          targetId: created.id,
          details: JSON.stringify({ addedUserId: user.id, role: "VIEWER" })
        }
      });
      return created;
    });
    return NextResponse.json({ data: { ...member, user }, message: "أُضيف العضو إلى المجلس. يمكنه اختيار المجلس بعد تسجيل الدخول." }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Council member add failed", error);
    return NextResponse.json({ error: "تعذرت إضافة العضو حاليًا" }, { status: 503, headers: NO_STORE });
  }
}
