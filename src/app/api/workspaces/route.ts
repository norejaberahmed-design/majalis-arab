import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { ACTIVE_WORKSPACE_COOKIE, hasTrustedOrigin } from "@/lib/workspace";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401, headers: NO_STORE });
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, workspace: { select: { id: true, name: true, slug: true } } }
    });
    return NextResponse.json({ data: memberships.map(m => ({ ...m.workspace, role: m.role })) }, { headers: NO_STORE });
  } catch (error) {
    console.error("Workspace listing failed", error);
    return NextResponse.json({ error: "تعذر تحميل مساحات العمل" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401, headers: NO_STORE });
  const body = await readJsonBody(request, 4096);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return NextResponse.json({ error: "بيانات مساحة العمل غير صالحة" }, { status: 400, headers: NO_STORE });
  }
  const name = (body.data as Record<string, unknown>).name;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
    return NextResponse.json({ error: "اسم مساحة العمل يجب أن يكون بين حرفين و80 حرفًا" }, { status: 400, headers: NO_STORE });
  }

  const cleanName = name.trim().replace(/\s+/g, " ");
  const slugBase = cleanName.normalize("NFKD").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "workspace";
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;
  try {
    const workspace = await prisma.$transaction(async tx => {
      const created = await tx.workspace.create({ data: { name: cleanName, slug } });
      await tx.workspaceMember.create({
        data: { workspaceId: created.id, userId: session.user.id, role: "OWNER" }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: created.id,
          actorUserId: session.user.id,
          actor: session.user.email,
          action: "WORKSPACE_CREATED",
          targetType: "Workspace",
          targetId: created.id
        }
      });
      return created;
    });
    const response = NextResponse.json({ data: { id: workspace.id, name: workspace.name, role: "OWNER" } }, { status: 201, headers: NO_STORE });
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30
    });
    return response;
  } catch (error) {
    console.error("Workspace creation failed", error);
    return NextResponse.json({ error: "تعذر إنشاء مساحة العمل" }, { status: 503, headers: NO_STORE });
  }
}
