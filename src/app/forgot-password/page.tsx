"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
      if (result.error) {
        setMessage("تعذر إرسال الطلب الآن. حاول لاحقًا.");
        return;
      }
      setSent(true);
      setMessage("إذا كان البريد مرتبطًا بحساب، فستصلك رسالة برابط إعادة التعيين.");
    } catch {
      setMessage("تعذر الاتصال بالخدمة. حاول لاحقًا.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell" dir="rtl">
      <Link href="/" className="auth-brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>استعادة الحساب</small></span></Link>
      <section className="auth-card">
        <p className="eyebrow">استعادة الوصول</p>
        <h1>إعادة تعيين كلمة المرور</h1>
        <p className="muted">أدخل بريدك الإلكتروني. لا نكشف ما إذا كان البريد مسجلًا في المنصة.</p>
        <form onSubmit={submit}>
          <label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={sent} /></label>
          {message && <p role="status" className="auth-hint">{message}</p>}
          {!sent && <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "جارٍ الإرسال…" : "إرسال رابط الاستعادة"}</button>}
        </form>
        <p className="auth-hint"><Link href="/">العودة إلى الصفحة الرئيسية</Link></p>
      </section>
    </main>
  );
}
