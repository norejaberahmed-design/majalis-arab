"use client";

import { FormEvent, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Regex بسيط للتحقق من البريد الإلكتروني
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // التحقق من الجلسة عند التحميل
  useEffect(() => {
    let active = true;
    setCheckingSession(true);

    authClient
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data?.session) {
          router.replace("/setup");
          router.refresh();
          return;
        }
      })
      .catch(() => {
        // المستخدم غير مسجل، نبقى في الصفحة
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  // إعادة تعيين الحالة للسماح بإدخال بريد جديد
  const resetForm = useCallback(() => {
    setSent(false);
    setMessage("");
    setEmail("");
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy || sent) return;

      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        setMessage("أدخل بريدك الإلكتروني.");
        return;
      }

      if (!EMAIL_REGEX.test(normalizedEmail)) {
        setMessage("صيغة البريد الإلكتروني غير صحيحة.");
        return;
      }

      setBusy(true);
      setMessage("");

      try {
        const result = await authClient.signIn.magicLink({
          email: normalizedEmail,
          callbackURL: "/setup",
        });

        if (result?.error) {
          setMessage(
            "تعذر إرسال رابط الدخول الآن. تحقق من البريد وحاول مرة أخرى."
          );
          return;
        }

        setSent(true);
        setMessage(
          "إذا أمكن إرسال الرابط لهذا البريد، فستصلك رسالة تحتوي على رابط دخول آمن. افحص الوارد والرسائل غير المرغوب فيها."
        );
      } catch {
        setMessage("تعذر الاتصال بخدمة البريد. حاول مرة أخرى بعد قليل.");
      } finally {
        setBusy(false);
      }
    },
    [busy, sent, email]
  );

  // أثناء التحقق من الجلسة، نعرض شاشة تحميل بسيطة
  if (checkingSession) {
    return (
      <main className="auth-shell" dir="rtl">
        <Link href="/" className="auth-brand">
          <span className="brand-mark">م</span>
          <span>
            <strong>مجالس العرب</strong>
            <small>البحث الموثق</small>
          </span>
        </Link>
        <section className="auth-card" aria-busy="true">
          <p className="muted">جارٍ التحقق من الجلسة…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell" dir="rtl">
      <Link href="/" className="auth-brand">
        <span className="brand-mark">م</span>
        <span>
          <strong>مجالس العرب</strong>
          <small>البحث الموثق</small>
        </span>
      </Link>

      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">دخول آمن بالبريد الإلكتروني</p>
        <h1 id="auth-title">الدخول إلى حسابك</h1>
        <p className="muted">
          أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا للدخول. لا تحتاج إلى كلمة
          مرور. إذا لم يكن لديك حساب، فسيتم إنشاء حسابك عند إكمال الدخول.
        </p>

        <form onSubmit={submit} aria-busy={busy} noValidate>
          <label htmlFor="login-email">البريد الإلكتروني</label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (message) setMessage("");
            }}
            maxLength={254}
            required
            disabled={busy || sent}
            placeholder="name@example.com"
            aria-invalid={!!message && !sent}
            aria-describedby={message ? "login-message" : undefined}
          />

          {message && (
            <p
              id="login-message"
              role={sent ? "status" : "alert"}
              aria-live="polite"
              className={sent ? "auth-hint" : "auth-error"}
            >
              {message}
            </p>
          )}

          {!sent ? (
            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={busy || !email.trim()}
            >
              {busy ? "جارٍ إرسال الرابط…" : "إرسال رابط الدخول إلى بريدي"}
            </button>
          ) : (
            <button
              className="primary-button auth-submit"
              type="button"
              onClick={resetForm}
              disabled={busy}
            >
              استخدام بريد إلكتروني آخر
            </button>
          )}
        </form>

        <p className="auth-hint">
          الرابط صالح لمدة 10 دقائق ويُستخدم مرة واحدة. لا تشاركه مع أحد.
        </p>
      </section>

      <p className="auth-foot">
        لا يُعد وجود سجل في المنصة إثباتًا تاريخيًا؛ كل ادعاء يحتاج إلى مصدر
        ومراجعة.
      </p>
    </main>
  );
}
