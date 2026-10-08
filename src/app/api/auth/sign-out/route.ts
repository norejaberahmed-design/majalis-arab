import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ACTIVE_WORKSPACE_COOKIE, hasTrustedOrigin } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403 });
  const result = await auth.api.signOut({ headers: request.headers, asResponse: true });
  const response = result instanceof Response ? new NextResponse(result.body, { status: result.status, headers: result.headers }) : NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
