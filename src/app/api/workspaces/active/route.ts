import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { ACTIVE_WORKSPACE_COOKIE, hasTrustedOrigin } from "@/lib/workspace";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 4096);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    }

    const workspaceId = body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>).workspaceId
      : null;

    if (typeof workspaceId !== "string" || workspaceId.length < 1 || workspaceId.length > 64) {
      return NextResponse.json({ error: "معرّف مساحة العمل غير صالح" }, { status: 400, headers: NO_STORE });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
      select: { workspaceId: true }
    });

    if (!membership) {
      return NextResponse.json({ error: "لا تملك صلاحية الوصول إلى مساحة العمل" }, { status: 403, headers: NO_STORE });
    }

    const response = NextResponse.json({ data: { workspaceId } }, { headers: NO_STORE });
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, membership.workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return response;
  } catch (error) {
    console.error("Active workspace selection failed", error);
    return NextResponse.json(
      { error: "تعذر اختيار مساحة العمل حاليًا" },
      { status: 503, headers: NO_STORE }
    );
  }
}
