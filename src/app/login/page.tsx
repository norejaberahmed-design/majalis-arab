"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "signin" | "signup" | "forgot";

type Notice = {
  type: "success" | "error";
  message: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const result = await authClient.getSession();

        if (active && !result.error && result.data?.session) {
          router.replace("/");
          router.refresh();
          return;
        }
      } catch {
        // يسمح بعرض نموذج الدخول إذا تعذر فحص الجلسة.
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  function changeMode(next: Mode) {
    if (busy) return;

    setMode(next);
    setPassword("");
    setShowPassword(false);
    setNotice(null);
  }

  function error(message: string) {
    setNotice({ type: "error", message });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      error("يرجى إدخال بريد إلكتروني صحيح.");
      return;
    }

    if (mode === "signup" && name.trim().length < 2) {
      error("يرجى إدخال اسم لا يقل عن حرفين.");
      return;
    }

    if (mode !== "forgot" && password.length < 1) {
      error("يرجى إدخال كلمة المرور.");
      return;
    }

    if (mode === "signup" && password.length < 12) {
      error("كلمة المرور يجب أن تتكون من 12 حرفًا على الأقل.");
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: cleanEmail,
          password,
          callbackURL: "/",
        });

        if (result.error) {
          error(
            "تعذر إنشاء الحساب. تحقق من البيانات وحاول مجددًا."
          );
          return;
        }

        // لا نفترض أن البريد تم تأكيده أو أن الجلسة جاهزة.
        const sessionResult = await authClient.getSession();

        if (
          !sessionResult.error &&
          sessionResult.data?.session
        ) {
          router.replace("/");
          router.refresh();
          return;
        }

        setNotice({
          type: "success",
          message:
            "تم إرسال طلب التسجيل. افتح بريدك الإلكتروني وابحث عن رسالة التحقق، ثم اضغط رابط التأكيد لإكمال التسجيل.",
        });

        return;
      }

      if (mode === "signin") {
        const result = await authClient.signIn.email({
          email: cleanEmail,
          password,
          callbackURL: "/",
        });

        if (result.error) {
          error(
            "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور، وتأكد من تأكيد بريدك الإلكتروني."
          );
          return;
        }

        router.replace("/");
        router.refresh();
        return;
      }

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
      error(
        "تعذر الاتصال بخدمة التسجيل. تحقق من اتصالك وحاول مجددًا."
      );
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
            أنشئ حسابك، واكتشف التاريخ، واجمع المراجع،
            وشارك في مجتمع يحترم الدليل.
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

          <form
            className="signin-v2-form"
            onSubmit={submit}
            aria-busy={busy}
          >
            {mode === "signup" && (
              <label className="signin-v2-field">
                <span>الاسم</span>
                <input
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
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
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                maxLength={254}
                required
                disabled={busy}
              />
            </label>

            {mode !== "forgot" && (
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
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
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
                    disabled={busy}
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                  >
                    {showPassword ? "إخفاء" : "إظهار"}
                  </button>
                </div>
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
                  {notice.type === "success" ? "✓" : "!"}
                </span>
                <p>{notice.message}</p>
              </div>
            )}

            <button
              type="submit"
              className="signin-v2-submit"
              disabled={busy}
            >
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
              لا تشارك كلمة المرور مع أي شخص. استخدم بريدك
              الحقيقي لتتمكن من تأكيد حسابك واستعادته.
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
