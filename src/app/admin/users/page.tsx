import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listUsers } from "@/lib/services/users.service";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  USER: "مستخدم",
  CONTRIBUTOR: "مساهم",
  RESEARCHER: "باحث",
  MODERATOR: "مشرف",
  ADMIN: "مدير",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "نشط",
  SUSPENDED: "موقوف",
  BANNED: "محظور",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const search = params.search ?? "";

  const { users, total, totalPages } = await listUsers(session.user.role, { page, search });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-800">إدارة المستخدمين</h1>
        <a href="/admin" className="btn-ghost text-sm">رجوع</a>
      </div>

      {/* بحث */}
      <form action="/admin/users" className="flex gap-2">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="ابحث بالاسم أو البريد..."
          className="input-field"
        />
        <button type="submit" className="btn-secondary shrink-0">بحث</button>
      </form>

      <p className="text-sm text-brand-500">{total} مستخدم</p>

      {/* قائمة المستخدمين */}
      <div className="space-y-2">
        {users.length === 0 ? (
          <div className="card text-center py-8 text-brand-400 text-sm">لا يوجد مستخدمون</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="card flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-brand-800">{u.displayName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    u.role === "ADMIN" ? "bg-red-100 text-red-600" :
                    u.role === "MODERATOR" ? "bg-blue-100 text-blue-600" :
                    u.role === "RESEARCHER" ? "bg-purple-100 text-purple-600" :
                    u.role === "CONTRIBUTOR" ? "bg-green-100 text-green-600" :
                    "bg-brand-100 text-brand-600"
                  }`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    u.status === "ACTIVE" ? "bg-green-50 text-green-600" :
                    u.status === "SUSPENDED" ? "bg-yellow-50 text-yellow-600" :
                    "bg-red-50 text-red-600"
                  }`}>
                    {STATUS_LABELS[u.status]}
                  </span>
                </div>
                <p className="text-xs text-brand-400 mt-1 truncate">{u.email}</p>
              </div>
              <div className="shrink-0">
                <UserActions userId={u.id} currentRole={u.role} currentStatus={u.status} adminId={session.user.id} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <a href={`/admin/users?search=${encodeURIComponent(search)}&page=${page - 1}`} className="btn-secondary text-sm">السابق</a>
          )}
          <span className="px-3 py-2 text-sm text-brand-500">{page} / {totalPages}</span>
          {page < totalPages && (
            <a href={`/admin/users?search=${encodeURIComponent(search)}&page=${page + 1}`} className="btn-secondary text-sm">التالي</a>
          )}
        </div>
      )}
    </div>
  );
}

// مكون تفاعلي لتغيير الدور والحالة
function UserActions({ userId, currentRole, currentStatus }: { userId: string; currentRole: string; currentStatus: string; adminId: string }) {
  return (
    <div className="flex gap-1">
      <form action={`/api/admin/users/${userId}/role`} method="POST" className="inline">
        <input type="hidden" name="role" value={currentRole === "ADMIN" ? "USER" : "ADMIN"} />
        <button type="submit" className="btn-ghost text-xs" title="تبديل الدور">
          تبديل الدور
        </button>
      </form>
    </div>
  );
}
