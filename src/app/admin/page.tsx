import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const [userCount, entityCount, auditCount] = await Promise.all([
    prisma.user.count(),
    prisma.entity.count(),
    prisma.auditLog.count(),
  ]);

  const recentLogs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { displayName: true } } },
  });

  const sections = [
    { href: "/admin/users", label: "المستخدمون", icon: "👥" },
    { href: "#", label: "الأدوار", icon: "🎭", disabled: true },
    { href: "#", label: "الكيانات", icon: "🏛", disabled: true },
    { href: "#", label: "الادعاءات", icon: "📋", disabled: true },
    { href: "#", label: "المصادر", icon: "📚", disabled: true },
    { href: "#", label: "الوثائق", icon: "📄", disabled: true },
    { href: "#", label: "الروايات", icon: "📖", disabled: true },
    { href: "#", label: "التعارضات", icon: "⚠️", disabled: true },
    { href: "#", label: "طابور المراجعة", icon: "✅", disabled: true },
    { href: "#", label: "البلاغات", icon: "🚩", disabled: true },
    { href: "#", label: "الإشراف", icon: "🛡️", disabled: true },
    { href: "#", label: "سجل التدقيق", icon: "📜", disabled: true },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold text-brand-800">لوحة الإدارة</h1>

      {/* إحصائيات */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand-700">{userCount}</div>
          <div className="text-xs text-brand-400 mt-1">مستخدم</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand-700">{entityCount}</div>
          <div className="text-xs text-brand-400 mt-1">كيان</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand-700">{auditCount}</div>
          <div className="text-xs text-brand-400 mt-1">سجل تدقيق</div>
        </div>
      </div>

      {/* أقسام الإدارة */}
      <div>
        <h2 className="section-title mb-3">الأقسام</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sections.map((s) => (
            <div key={s.label}>
              {s.disabled ? (
                <div className="card opacity-50 cursor-not-allowed space-y-1">
                  <div className="flex items-center gap-2">
                    <span>{s.icon}</span>
                    <span className="text-sm font-medium text-brand-700">{s.label}</span>
                  </div>
                  <p className="text-xs text-brand-300">قريبًا</p>
                </div>
              ) : (
                <a href={s.href} className="card hover:border-brand-300 hover:shadow-md transition-all space-y-1 block">
                  <div className="flex items-center gap-2">
                    <span>{s.icon}</span>
                    <span className="text-sm font-medium text-brand-700">{s.label}</span>
                  </div>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* آخر سجلات التدقيق */}
      <div>
        <h2 className="section-title mb-3">آخر العمليات</h2>
        <div className="card space-y-2">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-brand-400 text-center py-4">لا توجد سجلات</p>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-2 text-sm border-b border-brand-50 last:border-0 pb-2 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-brand-100 text-brand-600 px-2 py-0.5 rounded">{log.action}</span>
                  <span className="text-brand-500">{log.actor?.displayName ?? "—"}</span>
                </div>
                <span className="text-xs text-brand-300">
                  {new Date(log.createdAt).toLocaleDateString("ar")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
