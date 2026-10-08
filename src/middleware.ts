import { NextRequest, NextResponse } from "next/server";
import { shouldBlockProduction } from "@/lib/release-gate";

/**
 * Temporary release safety gate.
 *
 * The current application has no authentication, authorization, or tenant
 * isolation. Do not expose research records publicly until those controls are
 * implemented and tested. Development remains available for local work.
 *
 * Remove this gate only in a reviewed change after auth/RBAC/isolation tests pass.
 */
export function middleware(request: NextRequest) {
  if (shouldBlockProduction(process.env.NODE_ENV)) {
    const path = request.nextUrl.pathname;
    const authSurface =
      path === "/login" ||
      path === "/setup" ||
      path.startsWith("/api/auth/") ||
      path === "/api/workspaces" ||
      path === "/api/workspaces/active";
    if (!authSurface) {
      return new NextResponse(
        "مجالس العرب غير متاح للإنتاج بعد. ما زالت مراجعة الحماية والاختبارات مطلوبة.",
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
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"]
};
