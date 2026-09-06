"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="card space-y-5">
        <h1 className="text-xl font-bold text-brand-800 text-center">تسجيل الدخول</h1>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label-field">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>

        <p className="text-center text-sm text-brand-500">
          ليس لديك حساب؟{" "}
          <Link href="/register" className="text-brand-700 font-medium hover:underline">
            أنشئ حسابًا
          </Link>
        </p>
      </div>
    </div>
  );
}
