import { NextRequest, NextResponse } from "next/server";

/**
 * Temporary release safety gate.
 *
 * The current application has no authentication, authorization, or tenant
 * isolation. Do not expose research records publicly until those controls are
 * implemented and tested. Development remains available for local work.
 *
 * Remove this gate only in a reviewed change after auth/RBAC/isolation tests pass.
 */
export function middleware(_request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(
      "مجالس العرب غير متاح للعامة بعد. لم يكتمل نظام تسجيل الدخول وعزل البيانات.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
          "Retry-After": "3600",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "no-referrer"
        }
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"]
};
