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
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    setBusy(true);

    // Email addresses are trimmed and normalized consistently before submission.
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: normalizedEmail,
          password
        });

        if (result.error) {
          setMessage("تعذر إنشاء الحساب. تحقق من البيانات وحاول مجددًا، أو سجّل الدخول إذا كان لديك حساب.");
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          // Never enter the protected setup flow unless the server confirms a session.
          const sessionCheck = await authClient.getSession();
          if (sessionCheck.error || !sessionCheck.data?.session) {
            setMessage("تم إرسال طلب إنشاء الحساب، لكن لم يتم تأكيد جلسة الدخول. سجّل الدخول باستخدام بياناتك.");
            setMode("signin");
            setPassword("");
            return;
          }
          router.replace("/setup");
          router.refresh();
          return;
        }

        setMessage("إذا اكتملت بيانات الحساب، فتحقق من بريدك الإلكتروني لتفعيل الحساب، ثم سجّل الدخول.");
        setMode("signin");
        setPassword("");
        return;
      }

      const result = await authClient.signIn.email({
        email: normalizedEmail,
        password
      });

      if (result.error) {
        // Keep the message generic so the form does not reveal account existence.
        setMessage("تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور، ثم حاول مجددًا.");
        return;
      }

      // A successful response alone is not enough: confirm that the session is readable.
      const sessionCheck = await authClient.getSession();
      if (sessionCheck.error || !sessionCheck.data?.session) {
        setMessage("لم يتم تأكيد جلسة الدخول. حاول مرة أخرى، وإذا استمرت المشكلة فأعد تحميل الصفحة.");
        return;
      }

      router.replace("/setup");
      router.refresh();
    } catch {
      setMessage("تعذر الاتصال بالخدمة. تحقق من اتصالك وحاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    if (busy) return;
    setMode(mode === "signin" ? "signup" : "signin");
    setMessage("");
    setShowPassword(false);
  }

  return (
    <main className="auth-shell" dir="rtl">
      <Link href="/" className="auth-brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>البحث الموثق</small></span></Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">دخول آمن إلى مساحة البحث</p>
        <h1 id="auth-title">{mode === "signin" ? "مرحبًا بعودتك" : "إنشاء حساب جديد"}</h1>
        <p className="muted">استخدم بريدك الإلكتروني وكلمة مرورك. لا تشارك كلمة المرور مع أي شخص.</p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              الاسم
              <input
                autoComplete="name"
                value={name}
                onChange={event => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                required
                disabled={busy}
              />
            </label>
          )}
          <label>
            البريد الإلكتروني
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              value={email}
              onChange={event => setEmail(event.target.value)}
              maxLength={254}
              required
              disabled={busy}
            />
          </label>
          <label>
            كلمة المرور
            <span className="auth-password-row">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
                dir="ltr"
              />
              <button
                className="auth-password-toggle"
                type="button"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(value => !value)}
                disabled={busy}
              >
                {showPassword ? "إخفاء" : "إظهار"}
              </button>
            </span>
          </label>
          {mode === "signin" && <p className="auth-hint"><Link href="/forgot-password">نسيت كلمة المرور؟</Link></p>}
          {mode === "signup" && <p className="auth-hint">استخدم 12 حرفًا على الأقل، وتجنب إعادة استخدام كلمة مرور من خدمة أخرى.</p>}
          {message && <p role="alert" aria-live="polite" className="auth-error">{message}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? "جارٍ التحقق…" : mode === "signin" ? "تسجيل الدخول" : "إنشاء الحساب"}
          </button>
        </form>
        <button className="auth-switch" type="button" onClick={switchMode} disabled={busy}>
          {mode === "signin" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </section>
      <p className="auth-foot">لا يُعد وجود سجل في المنصة إثباتًا تاريخيًا؛ كل ادعاء يحتاج إلى مصدر ومراجعة.</p>
    </main>
  );
}
