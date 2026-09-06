"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const items = [
    { href: "/", label: "الرئيسية", icon: "🏠" },
    { href: "/search", label: "بحث", icon: "🔍" },
  ];

  if (session?.user) {
    items.push({ href: "/dashboard", label: "لوحتي", icon: "📋" });
    if (session.user.role === "ADMIN") {
      items.push({ href: "/admin", label: "الإدارة", icon: "⚙️" });
    }
  } else {
    items.push({ href: "/login", label: "دخول", icon: "🔑" });
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-brand-100 flex justify-around items-center h-16 px-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              active ? "text-brand-700 bg-brand-50" : "text-brand-400"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
