import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "مجالس العرب | البحث الموثق",
  description: "منصة بحث عربية لتنظيم الكيانات والعلاقات التاريخية مع إظهار المصادر والأدلة وما لا نعرفه بعد."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}