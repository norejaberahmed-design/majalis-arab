"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "signin" | "signup" | "forgot";

type Notice = {
  type: "success" | "error" | "info";
  message: string;
  action?: { label: string; onClick: () => void };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ============================================================
   مؤشر قوة كلمة المرور
   ============================================================ */
function getPasswordStrength(pw: string) {
  const checks = {
    length: pw.length >= 12,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;

  const label =
    score <= 1
      ? "ضعيفة جدًا"
      : score === 2
        ? "ضعيفة"
        : score === 3
          ? "متوسطة"
          : score === 4
            ? "قوية"
            : "قوية جدًا";

  const level = score <= 1 ? 1 : score === 2 ? 2 : score === 3 ? 3 : 4;

  return { score, label, level, checks };
}

function PasswordStrength({ password }: { password: string }) {
  const { label, level, checks } = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className="signin-v2-strength" aria-live="polite">
      <div className="signin-v2-strength-bar">
        <span className={`level-${level}`} />
      </div>
      <div className="signin-v2-strength-meta">
        <span>{label}</span>
        <ul>
          <li data-ok={checks.length}>12 حرفًا</li>
          <li data-ok={checks.upper || checks.lower}>حروف</li>
          <li data-ok={checks.digit}>أرقام</li>
          <li data-ok={checks.symbol}>رموز</li>
        </ul>
      </div>
    </div>
  );
}

/* ============================================================
   الصفحة الرئيسية
   ============================================================ */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ الإصلاح 5: حفظ الصفحة السابقة
  const redirectTo = useMemo(() => {
    const raw = searchParams.get("redirect") || "/";
    // منع open redirect: يجب أن يبدأ بـ /
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  }, [searchParams]);

  // ✅ الإصلاح 1: الوضع الافتراضي = تسجيل الدخول
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // ✅ الإصلاح 2
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  /* فحص الجلسة */
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    (async () => {
      try {
        const result = await authClient.getSession();
        if (!active) return;
        if (!result.error && result.data?.session) {
          router.replace(redirectTo);
          router.refresh();
          return;
        }
      } catch {
        /* تجاهل */
      } finally {
        if (active) setCheckingSession(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [router, redirectTo]);

  /* تبديل الوضع — ✅ تصفير كل الحقول */
  function changeMode(next: Mode) {
    if (busy) return;
    setMode(next);
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
    setNotice(null);
  }

  function error(message: string) {
    setNotice({ type: "error", message });
  }

  /* ✅ إعادة إرسال رسالة التأكيد */
  async function resendVerification(targetEmail: string) {
    try {
      const result = await authClient.sendVerificationEmail?.({
        email: targetEmail,
        callbackURL: redirectTo,
      });
      if (result?.error) {
        error("تعذر إعادة إرسال الرسالة. حاول لاحقًا.");
        return;
      }
      setNotice({
        type: "success",
        message: "تم إعادة إرسال رسالة التأكيد إلى بريدك.",
      });
    } catch {
      error("تعذر إعادة إرسال الرسالة. حاول لاحقًا.");
    }
  }

  /* الإرسال */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim().toLowerCase();

    // تحقق البريد
    if (!EMAIL_RE.test(cleanEmail)) {
      error("يرجى إدخال بريد إلكتروني صحيح.");
      return;
    }

    // تحقق الاسم
    if (mode === "signup" && name.trim().length < 2) {
      error("يرجى إدخال اسم لا يقل عن حرفين.");
      return;
    }

    // تحقق كلمة المرور
    if (mode !== "forgot") {
      if (password.length < 1) {
        error("يرجى إدخال كلمة المرور.");
        return;
      }
      if (mode === "signup") {
        if (password.length < 12) {
          error("كلمة المرور يجب أن تتكون من 12 حرفًا على الأقل.");
          return;
        }
        // ✅ الإصلاح 2: تطابق كلمتي المرور
        if (password !== confirmPassword) {
          error("كلمتا المرور غير متطابقتين.");
          return;
        }
      }
    }

    setBusy(true);
    setNotice(null);

    try {
      /* ============ إنشاء حساب ============ */
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: cleanEmail,
          password,
          callbackURL: redirectTo, // ✅ الإصلاح 5
        });

        if (result.error) {
          error(
            result.error.status === 429
              ? "تم تجاوز الحد المؤقت لمحاولات التسجيل. انتظر قليلًا ثم حاول مجددًا."
              : "تعذر إنشاء الحساب. تحقق من البيانات وحاول مجددًا."
          );
          return;
        }

        const sessionResult = await authClient.getSession();
        if (!sessionResult.error && sessionResult.data?.session) {
          router.replace(redirectTo);
          router.refresh();
          return;
        }

        // ✅ الإصلاح 4: زر إعادة إرسال
        setNotice({
          type: "success",
          message:
            "تم إرسال طلب التسجيل. افتح بريدك وابحث عن رسالة التحقق ثم اضغط رابط التأكيد.",
          action: {
            label: "إعادة إرسال الرسالة",
            onClick: () => void resendVerification(cleanEmail),
          },
        });
        return;
      }

      /* ============ تسجيل دخول ============ */
      if (mode === "signin") {
        const result = await authClient.signIn.email({
          email: cleanEmail,
          password,
          callbackURL: redirectTo, // ✅ الإصلاح 5
        });

        if (result.error) {
          error(
            result.error.status === 429
              ? "تم تجاوز الحد المؤقت لمحاولات الدخول. انتظر قليلًا ثم حاول مجددًا."
              : "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور."
          );
          return;
        }

        router.replace(redirectTo);
        router.refresh();
        return;
      }

      /* ============ استعادة كلمة المرور ============ */
      const result = await authClient.requestPasswordReset({
        email: cleanEmail,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        error("تعذر إرسال تعليمات الاستعادة. حاول مجددًا لاحقًا.");
        return;
      }

      setNotice({
        type: "success",
        message:
          "إذا كان البريد مرتبطًا بحساب، فستصلك تعليمات إعادة تعيين كلمة المرور.",
      });
    } catch {
      error("تعذر الاتصال بخدمة التسجيل. تحقق من اتصالك وحاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="signin-v2-page" dir="rtl">
        <div className="signin-v2-loading" role="status">
          <span className="signin-v2-mark">م</span>
          <span>جارٍ التحقق من الحساب…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="signin-v2-page" dir="rtl">
      {/* الشريط الجانبي */}
      <aside className="signin-v2-aside">
        <Link href="/" className="signin-v2-brand">
          <span className="signin-v2-mark">م</span>
          <span>
            <strong>مجالس العرب</strong>
            <small>المعرفة تبدأ بالمصدر</small>
          </span>
        </Link>

        <div className="signin-v2-intro">
          <span className="signin-v2-overline">
            <i />
            مساحة للمعرفة الموثقة
          </span>

          <h1>
            لكل رواية
            <br />
            <em>مصدر يستحق أن يُقرأ.</em>
          </h1>

          <p>
            أنشئ حسابك، واكتشف التاريخ، واجمع المراجع، وشارك في مجتمع
            يحترم الدليل.
          </p>

          <ul>
            <li>
              <span>✓</span>
              <div>
                <strong>حسابك الخاص</strong>
                <small>احتفظ بمشاركاتك ومجالسك.</small>
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <strong>تسجيل بالبريد الإلكتروني</strong>
                <small>تحقق من بريدك لتأمين حسابك.</small>
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <strong>معرفة موثقة</strong>
                <small>اجعل المصادر أساس مشاركاتك.</small>
              </div>
            </li>
          </ul>
        </div>

        <p className="signin-v2-footnote">
          مجالس العرب <b>·</b> المعرفة مسؤولية مشتركة
        </p>
      </aside>

      {/* النموذج */}
      <section className="signin-v2-main">
        <div className="signin-v2-mobile-brand">
          <span className="signin-v2-mark">م</span>
          <strong>مجالس العرب</strong>
        </div>

        <div className="signin-v2-card">
          <header className="signin-v2-heading">
            <span>حسابك في مجالس العرب</span>
            <h2>
              {mode === "signup"
                ? "أنشئ حسابك"
                : mode === "signin"
                  ? "مرحبًا بعودتك"
                  : "استعادة كلمة المرور"}
            </h2>
            <p>
              {mode === "signup"
                ? "أدخل بياناتك للبدء. سنطلب منك تأكيد بريدك إذا كان التحقق مفعّلًا."
                : mode === "signin"
                  ? "سجّل الدخول للمتابعة إلى الصفحة الرئيسية."
                  : "أدخل بريدك لاستلام تعليمات الاستعادة."}
            </p>
          </header>

          <div className="signin-v2-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "selected" : ""}
              disabled={busy}
              onClick={() => changeMode("signup")}
            >
              إنشاء حساب
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "selected" : ""}
              disabled={busy}
              onClick={() => changeMode("signin")}
            >
              تسجيل الدخول
            </button>
          </div>

          <form className="signin-v2-form" onSubmit={submit} aria-busy={busy}>
            {mode === "signup" && (
              <label className="signin-v2-field">
                <span>الاسم</span>
                <input
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="الاسم الذي سيظهر في المجلس"
                  minLength={2}
                  maxLength={80}
                  required
                  disabled={busy}
                />
              </label>
            )}

            <label className="signin-v2-field">
              <span>البريد الإلكتروني</span>
              <input
                name="email"
                type="email"
                dir="ltr"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                maxLength={254}
                required
                disabled={busy}
              />
            </label>

            {mode !== "forgot" && (
              <>
                <label className="signin-v2-field">
                  <span>كلمة المرور</span>
                  <div className="signin-v2-password">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      dir="ltr"
                      autoComplete={
                        mode === "signup"
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === "signup"
                          ? "12 حرفًا على الأقل"
                          : "أدخل كلمة المرور"
                      }
                      minLength={mode === "signup" ? 12 : undefined}
                      maxLength={128}
                      required
                      disabled={busy}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                      }
                      disabled={busy}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? "إخفاء" : "إظهار"}
                    </button>
                  </div>
                </label>

                {/* ✅ الإصلاح 3: مؤشر القوة (للتسجيل فقط) */}
                {mode === "signup" && <PasswordStrength password={password} />}
              </>
            )}

            {/* ✅ الإصلاح 2: تأكيد كلمة المرور */}
            {mode === "signup" && (
              <label className="signin-v2-field">
                <span>تأكيد كلمة المرور</span>
                <div className="signin-v2-password">
                  <input
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    dir="ltr"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور"
                    minLength={12}
                    maxLength={128}
                    required
                    disabled={busy}
                    aria-invalid={
                      confirmPassword.length > 0 &&
                      confirmPassword !== password
                    }
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirm ? "إخفاء التأكيد" : "إظهار التأكيد"
                    }
                    disabled={busy}
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? "إخفاء" : "إظهار"}
                  </button>
                </div>
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <small className="signin-v2-hint error">
                    كلمتا المرور غير متطابقتين
                  </small>
                )}
              </label>
            )}

            {mode === "signin" && (
              <div className="signin-v2-forgot">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeMode("forgot")}
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
            )}

            {notice && (
              <div
                className={`signin-v2-notice ${notice.type}`}
                role={notice.type === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                <span aria-hidden="true">
                  {notice.type === "success"
                    ? "✓"
                    : notice.type === "error"
                      ? "!"
                      : "i"}
                </span>
                <div>
                  <p>{notice.message}</p>
                  {/* ✅ الإصلاح 4 */}
                  {notice.action && (
                    <button
                      type="button"
                      className="signin-v2-notice-action"
                      onClick={notice.action.onClick}
                    >
                      {notice.action.label}
                    </button>
                  )}
                </div>
              </div>
            )}

            <button type="submit" className="signin-v2-submit" disabled={busy}>
              {busy
                ? "جارٍ المعالجة…"
                : mode === "signup"
                  ? "إنشاء الحساب"
                  : mode === "signin"
                    ? "تسجيل الدخول"
                    : "إرسال تعليمات الاستعادة"}
              {!busy && <span aria-hidden="true">←</span>}
            </button>
          </form>

          <div className="signin-v2-bottom">
            {mode === "signup" && (
              <p>
                لديك حساب بالفعل؟{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeMode("signin")}
                >
                  سجّل الدخول
                </button>
              </p>
            )}
            {mode === "signin" && (
              <p>
                مستخدم جديد؟{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeMode("signup")}
                >
                  أنشئ حسابًا
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => changeMode("signin")}
              >
                العودة إلى تسجيل الدخول
              </button>
            )}
          </div>

          <div className="signin-v2-security">
            <span aria-hidden="true">⌑</span>
            <p>
              لا تشارك كلمة المرور مع أي شخص. استخدم بريدك الحقيقي لتتمكن من
              تأكيد حسابك واستعادته.
            </p>
          </div>
        </div>

        <p className="signin-v2-legal">
          مجتمع يقوم على التوثيق واحترام اختلاف الروايات.
        </p>
      </section>
    </main>
  );
}
