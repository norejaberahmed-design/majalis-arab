"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-brand-100">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* الشعار */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-brand-700">مجالس عرب</span>
        </Link>

        {/* روابط سطح المكتب */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/" className="btn-ghost">الرئيسية</Link>
          <Link href="/search" className="btn-ghost">بحث</Link>
          {session?.user ? (
            <>
              <Link href="/dashboard" className="btn-ghost">لوحتي</Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin" className="btn-ghost">الإدارة</Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn-ghost"
              >
                خروج
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">دخول</Link>
              <Link href="/register" className="btn-primary">تسجيل</Link>
            </>
          )}
        </nav>

        {/* قائمة الهاتف */}
        {session?.user && (
          <button
            className="md:hidden btn-ghost"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="القائمة"
          >
            ☰
          </button>
        )}
      </div>

      {/* قائمة الهاتف المنسدلة */}
      {menuOpen && session?.user && (
        <div className="md:hidden border-t border-brand-100 bg-white px-4 py-2 space-y-1">
          <Link href="/dashboard" className="block btn-ghost" onClick={() => setMenuOpen(false)}>
            لوحتي
          </Link>
          <Link href="/profile" className="block btn-ghost" onClick={() => setMenuOpen(false)}>
            ملفي
          </Link>
          <Link href="/settings" className="block btn-ghost" onClick={() => setMenuOpen(false)}>
            الإعدادات
          </Link>
          {session.user.role === "ADMIN" && (
            <Link href="/admin" className="block btn-ghost" onClick={() => setMenuOpen(false)}>
              الإدارة
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="block w-full text-right btn-ghost"
          >
            خروج
          </button>
        </div>
      )}
    </header>
  );
}
