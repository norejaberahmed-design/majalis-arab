"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token") || "";
    setToken(value);
    setReady(true);
    if (!value) setMessage("الرابط غير مكتمل. اطلب رابط إعادة تعيين جديدًا.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!token) {
      setMessage("الرابط غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.");
      return;
    }
    if (password !== confirmation) {
      setMessage("كلمتا المرور غير متطابقتين.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setMessage("تعذر تغيير كلمة المرور. قد يكون الرابط منتهي الصلاحية؛ اطلب رابطًا جديدًا.");
        return;
      }
      setComplete(true);
      setMessage("تم تغيير كلمة المرور. يمكنك الآن تسجيل الدخول.");
    } catch {
      setMessage("تعذر الاتصال بالخدمة. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell" dir="rtl">
      <Link href="/" className="auth-brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>استعادة الحساب</small></span></Link>
      <section className="auth-card">
        <p className="eyebrow">حماية الحساب</p>
        <h1>اختر كلمة مرور جديدة</h1>
        <p className="muted">استخدم كلمة مرور من 12 حرفًا على الأقل، ولا تعِد استخدام كلمة مرور لخدمة أخرى.</p>
        <form onSubmit={submit}>
          <label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} maxLength={128} required disabled={!ready || !token || complete} /></label>
          <label>تأكيد كلمة المرور<input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} maxLength={128} required disabled={!ready || !token || complete} /></label>
          {message && <p role="status" className="auth-hint">{message}</p>}
          {ready && token && !complete && <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "جارٍ التغيير…" : "تغيير كلمة المرور"}</button>}
        </form>
        {complete ? <button className="primary-button auth-submit" type="button" onClick={() => router.replace("/login")}>العودة لتسجيل الدخول</button> : <p className="auth-hint"><Link href="/forgot-password">طلب رابط جديد</Link></p>}
      </section>
    </main>
  );
}
