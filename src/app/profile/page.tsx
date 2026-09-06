"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", bio: "", avatarUrl: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/profile`)
        .then((r) => r.json())
        .then((data) => {
          setForm({
            displayName: data.displayName ?? "",
            bio: data.bio ?? "",
            avatarUrl: data.avatarUrl ?? "",
          });
          setLoading(false);
        });
    }
  }, [session?.user?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setMessage("تم الحفظ بنجاح");
    } else {
      setMessage("حدث خطأ أثناء الحفظ");
    }
    setSaving(false);
  }

  if (loading) return <div className="max-w-md mx-auto px-4 py-8 text-brand-400">جارٍ التحميل...</div>;

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="card space-y-5">
        <h1 className="text-xl font-bold text-brand-800">الملف الشخصي</h1>

        {message && (
          <div className={`text-sm rounded-lg p-3 text-center ${
            message.includes("خطأ") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">اسم العرض</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="input-field"
              required
              minLength={2}
              maxLength={50}
            />
          </div>
          <div>
            <label className="label-field">النبذة</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="input-field min-h-24 resize-y"
              maxLength={500}
              placeholder="نبذة عنك..."
            />
          </div>
          <div>
            <label className="label-field">رابط الصورة</label>
            <input
              type="url"
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              className="input-field"
              placeholder="https://..."
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>
      </div>
    </div>
  );
}
