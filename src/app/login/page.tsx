"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setMessage(result.error.message || "تعذر إكمال العملية. تحقق من البيانات وحاول مجددًا.");
        return;
      }
      if (mode === "signup") {
        if (process.env.NODE_ENV !== "production") {
          // Local development has no guaranteed SMTP delivery; create the account and continue.
          router.replace("/setup");
          router.refresh();
          return;
        }
        setMessage("تم إنشاء الحساب وحفظ بياناتك. افتح رسالة التحقق في بريدك الإلكتروني لتفعيل الحساب، ثم سجّل الدخول.");
        setMode("signin");
        setPassword("");
        return;
      }
      router.replace("/setup");
      router.refresh();
    } catch {
      setMessage("تعذر الاتصال بالخدمة. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell" dir="rtl">
      <Link href="/" className="auth-brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>البحث الموثق</small></span></Link>
      <section className="auth-card">
        <p className="eyebrow">دخول آمن إلى مساحة البحث</p>
        <h1>{mode === "signin" ? "مرحبًا بعودتك" : "إنشاء حساب جديد"}</h1>
        <p className="muted">تُحفظ جلسات الدخول على الخادم. لا تشارك كلمة المرور مع أي شخص.</p>
        <form onSubmit={submit}>
          {mode === "signup" && <label>الاسم<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} required /></label>}
          <label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required /></label>
          <label>كلمة المرور<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={128} required /></label>
          {mode === "signin" && <p className="auth-hint"><Link href="/forgot-password">نسيت كلمة المرور؟</Link></p>}
          {mode === "signup" && <p className="auth-hint">استخدم 12 حرفًا على الأقل. لا تستخدم كلمة مرور تستعملها في خدمة أخرى.</p>}
          {message && <p role="alert" className="auth-error">{message}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "جارٍ التنفيذ…" : mode === "signin" ? "تسجيل الدخول" : "إنشاء الحساب"}</button>
        </form>
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
          {mode === "signin" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </section>
      <p className="auth-foot">لا يُعد وجود سجل في المنصة إثباتًا تاريخيًا؛ كل ادعاء يحتاج إلى مصدر ومراجعة.</p>
    </main>
  );
}
