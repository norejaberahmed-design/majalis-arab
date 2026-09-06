import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مجالس عرب — منصة المعرفة العربية",
  description: "منصة عربية معرفية ومجتمعية للقبائل والعائلات والشخصيات والمصادر والروايات",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
