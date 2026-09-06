"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "حدث خطأ أثناء التسجيل");
        setLoading(false);
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setError("حدث خطأ في الاتصال");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="card space-y-5">
        <h1 className="text-xl font-bold text-brand-800 text-center">إنشاء حساب</h1>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 text-center">
            {error}
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
            <label className="label-field">البريد الإلكتروني</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label-field">كلمة المرور</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input-field"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="text-xs text-brand-400 mt-1">8 أحرف على الأقل</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
          </button>
        </form>

        <p className="text-center text-sm text-brand-500">
          لديك حساب؟{" "}
          <Link href="/login" className="text-brand-700 font-medium hover:underline">
            سجّل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
