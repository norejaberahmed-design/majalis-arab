"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    authClient.getSession().then(({ data, error }) => {
      if (active && !error && data?.session) {
        router.replace("/setup");
        router.refresh();
      }
    }).catch(() => {
      // The visitor is not signed in; keep the email sign-in form available.
    });
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("أدخل بريدك الإلكتروني.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.signIn.magicLink({
        email: normalizedEmail,
        callbackURL: "/setup"
      });
      if (result.error) {
        setMessage("تعذر إرسال رابط الدخول الآن. تحقق من البريد وحاول مرة أخرى.");
        return;
      }
      setSent(true);
      setMessage("إذا أمكن إرسال الرابط لهذا البريد، فستصلك رسالة تحتوي على رابط دخول آمن. افحص الوارد والرسائل غير المرغوب فيها.");
    } catch {
      setMessage("تعذر الاتصال بخدمة البريد. حاول مرة أخرى بعد قليل.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell" dir="rtl">
      <Link href="/" className="auth-brand">
        <span className="brand-mark">م</span>
        <span><strong>مجالس العرب</strong><small>البحث الموثق</small></span>
      </Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">دخول آمن بالبريد الإلكتروني</p>
        <h1 id="auth-title">الدخول إلى حسابك</h1>
        <p className="muted">أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا للدخول. لا تحتاج إلى كلمة مرور. إذا لم يكن لديك حساب، فسيتم إنشاء حسابك عند إكمال الدخول.</p>
        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="login-email">البريد الإلكتروني</label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            value={email}
            onChange={event => { setEmail(event.target.value); setSent(false); setMessage(""); }}
            maxLength={254}
            required
            disabled={busy || sent}
            placeholder="name@example.com"
          />
          {message && <p role={sent ? "status" : "alert"} aria-live="polite" className={sent ? "auth-hint" : "auth-error"}>{message}</p>}
          {!sent ? (
            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? "جارٍ إرسال الرابط…" : "إرسال رابط الدخول إلى بريدي"}
            </button>
          ) : (
            <button className="primary-button auth-submit" type="button" onClick={() => { setSent(false); setMessage(""); }} disabled={busy}>
              استخدام بريد إلكتروني آخر
            </button>
          )}
        </form>
        <p className="auth-hint">الرابط صالح لمدة 10 دقائق ويُستخدم مرة واحدة. لا تشاركه مع أحد.</p>
      </section>
      <p className="auth-foot">لا يُعد وجود سجل في المنصة إثباتًا تاريخيًا؛ كل ادعاء يحتاج إلى مصدر ومراجعة.</p>
    </main>
  );
}
