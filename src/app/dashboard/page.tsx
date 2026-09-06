"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") return <div className="max-w-4xl mx-auto px-4 py-8 text-brand-400">جارٍ التحميل...</div>;
  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const sections = [
    { href: "/profile", label: "ملفي", icon: "👤", desc: "عرض وتحرير ملفك الشخصي" },
    { href: "#", label: "المحفوظات", icon: "🔖", desc: "المحتوى الذي حفظته", disabled: true },
    { href: "#", label: "منشوراتي", icon: "📝", desc: "منشوراتك في المجالس", disabled: true },
    { href: "#", label: "اقتراحاتي", icon: "💡", desc: "الادعاءات والتعديلات التي اقترحتها", disabled: true },
    { href: "#", label: "مراجعاتي", icon: "✅", desc: "المراجعات الموكولة إليك", disabled: true },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-800">لوحتي</h1>
        <p className="text-sm text-brand-500 mt-1">مرحبًا، {session?.user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map((s) => (
          <div key={s.label}>
            {s.disabled ? (
              <div className="card opacity-50 cursor-not-allowed space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className="font-medium text-brand-700">{s.label}</span>
                </div>
                <p className="text-xs text-brand-400">{s.desc}</p>
                <p className="text-xs text-brand-300">قريبًا</p>
              </div>
            ) : (
              <Link href={s.href} className="card hover:border-brand-300 hover:shadow-md transition-all space-y-1 block">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className="font-medium text-brand-700">{s.label}</span>
                </div>
                <p className="text-xs text-brand-400">{s.desc}</p>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
