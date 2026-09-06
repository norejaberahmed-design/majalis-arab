import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token, req }) => {
      const path = req.nextUrl.pathname;

      // مسارات تتطلب تسجيل دخول فقط
      if (["/profile", "/settings", "/dashboard"].includes(path)) {
        return !!token;
      }

      // مسارات الإدارة — تتطلب ADMIN
      if (path.startsWith("/admin")) {
        return token?.role === "ADMIN";
      }

      return true;
    },
  },
});

export const config = {
  matcher: ["/profile", "/settings", "/dashboard", "/admin/:path*"],
};
