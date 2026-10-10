
"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "signin" | "signup" | "magic" | "forgot";
type Notice = {
  type: "success" | "error";
  message: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
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

        if (
          active &&
          !result.error &&
          result.data?.session
        ) {
          router.replace("/research");
          router.refresh();
        }
      } catch {
        // يسمح بعرض صفحة الدخول عند تعذر التحقق.
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  function changeMode(nextMode: Mode) {
    if (busy) return;

    setMode(nextMode);
    setPassword("");
    setShowPassword(false);
    setNotice(null);
  }

  function showError(message: string) {
    setNotice({ type: "error", message });
  }

  async function signInWithGoogle() {
    if (busy) return;

    setBusy(true);
    setNotice(null);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/research",
      });

      if (result.error) {
        showError(
          "تعذر بدء الدخول عبر Google. تحقق من إعدادات OAuth وعنوان الموقع في الخادم."
        );
        setBusy(false);
      }
      // عند نجاح الطلب، يتولى Better Auth بدء إعادة التوجيه.
    } catch {
      showError(
        "تعذر الاتصال بخدمة تسجيل الدخول. تحقق من اتصالك ثم حاول مجددًا."
      );
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showError("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }

    if (mode === "signup" && name.trim().length < 2) {
      showError("يجب أن يتكون الاسم من حرفين على الأقل.");
      return;
    }

    if (
      (mode === "signin" || mode === "signup") &&
      password.length === 0
    ) {
      showError("أدخل كلمة المرور.");
      return;
    }

    if (mode === "signup" && password.length < 12) {
      showError("استخدم كلمة مرور من 12 حرفًا على الأقل.");
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      if (mode === "signin") {
        const result = await authClient.signIn.email({
          email: cleanEmail,
          password,
          callbackURL: "/research",
        });

        if (result.error) {
          showError(
            "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور."
          );
          return;
        }

        router.replace("/research");
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: cleanEmail,
          password,
          callbackURL: "/research",
        });

        if (result.error) {
          showError(
            "تعذر إنشاء الحساب. تحقق من البيانات أو جرّب بريدًا آخر."
          );
          return;
        }

        const sessionResult = await authClient.getSession();

        if (
          sessionResult.error ||
          !sessionResult.data?.session
        ) {
          setNotice({
            type: "success",
            message:
              "تم إرسال طلب إنشاء الحساب. إذا طُلب تأكيد البريد، أكّد حسابك ثم سجّل الدخول.",
          });
          return;
        }

        router.replace("/research");
        router.refresh();
        return;
      }

      if (mode === "magic") {
        const result = await authClient.signIn.magicLink({
          email: cleanEmail,
          callbackURL: "/research",
        });

        if (result.error) {
          showError(
            "تعذر إرسال رابط الدخول. تحقق من إعداد خدمة البريد."
          );
          return;
        }

        setNotice({
          type: "success",
          message:
            "إذا كان البريد مؤهلًا للدخول، فستصلك رسالة بالرابط. تحقق من صندوق الوارد والرسائل غير المرغوب فيها.",
        });
        return;
      }

      const result = await authClient.requestPasswordReset({
        email: cleanEmail,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        showError(
          "تعذر إرسال تعليمات الاستعادة. حاول لاحقًا."
        );
        return;
      }

      setNotice({
        type: "success",
        message:
          "إذا كان البريد مرتبطًا بحساب، فستصلك تعليمات إعادة تعيين كلمة المرور.",
      });
    } catch {
      showError(
        "حدث خطأ أثناء الاتصال بالخادم. حاول مجددًا."
      );
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    signin: "مرحبًا بعودتك",
    signup: "أنشئ حسابك",
    magic: "الدخول عبر البريد",
    forgot: "استعادة كلمة المرور",
  };

  const descriptions: Record<Mode, string> = {
    signin: "سجّل الدخول للمتابعة إلى مجالس العرب.",
    signup: "أنشئ حسابك وابدأ المشاركة في المجتمع.",
    magic: "سنرسل رابط الدخول إلى بريدك الإلكتروني.",
    forgot: "أدخل بريدك لاستلام تعليمات الاستعادة.",
  };

  if (checkingSession) {
    return (
      <main className="signin-v2-page" dir="rtl">
        <div className="signin-v2-loading" role="status">
          <span className="signin-v2-mark">م</span>
          <span>جارٍ التحقق من الجلسة…</span>
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
            اكتشف التاريخ، واجمع المراجع، وشارك في نقاش يحترم
            الدليل واختلاف الروايات.
          </p>

          <ul>
            <li>
              <span>✓</span>
              <div>
                <strong>مراجع يمكن الرجوع إليها</strong>
                <small>اربط المعلومات بمصادرها.</small>
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <strong>مساهماتك في مكان واحد</strong>
                <small>تابع مشاركاتك ومجالسك.</small>
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <strong>دخول آمن</strong>
                <small>حافظ على حسابك وبياناتك.</small>
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
            <span>مساحتك المعرفية</span>
            <h2>{titles[mode]}</h2>
            <p>{descriptions[mode]}</p>
          </header>

          {(mode === "signin" || mode === "signup") && (
            <div
              className="signin-v2-switch"
              role="tablist"
              aria-label="خيارات الحساب"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={mode === "signin" ? "selected" : ""}
                onClick={() => changeMode("signin")}
              >
                تسجيل الدخول
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "selected" : ""}
                onClick={() => changeMode("signup")}
              >
                إنشاء حساب
              </button>
            </div>
          )}

          <form
            className="signin-v2-form"
            onSubmit={submit}
            aria-busy={busy}
          >
            {mode === "signup" && (
              <label className="signin-v2-field">
                <span>الاسم</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="اسمك الذي سيظهر في المجلس"
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

            {(mode === "signin" || mode === "signup") && (
              <label className="signin-v2-field">
                <span>كلمة المرور</span>

                <div className="signin-v2-password">
                  <input
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
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={busy}
                    aria-label={
                      showPassword
                        ? "إخفاء كلمة المرور"
                        : "إظهار كلمة المرور"
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
              {busy ? (
                <>
                  <i />
                  جارٍ المعالجة…
                </>
              ) : mode === "signin" ? (
                "تسجيل الدخول"
              ) : mode === "signup" ? (
                "إنشاء الحساب"
              ) : mode === "magic" ? (
                "إرسال رابط الدخول"
              ) : (
                "إرسال تعليمات الاستعادة"
              )}

              {!busy && <span aria-hidden="true">←</span>}
            </button>
          </form>

          <div className="signin-v2-bottom">
            {mode === "signin" && (
              <>
                <p>
                  ليس لديك حساب؟{" "}
                  <button
                    type="button"
                    onClick={() => changeMode("signup")}
                  >
                    أنشئ حسابًا جديدًا
                  </button>
                </p>

                <button
                  type="button"
                  className="signin-v2-magic"
                  onClick={() => changeMode("magic")}
                >
                  الدخول برابط يُرسل إلى بريدك
                </button>
              </>
            )}

            {mode === "signup" && (
              <p>
                لديك حساب بالفعل؟{" "}
                <button
                  type="button"
                  onClick={() => changeMode("signin")}
                >
                  سجّل الدخول
                </button>
              </p>
            )}

            {(mode === "magic" || mode === "forgot") && (
              <button
                type="button"
                onClick={() => changeMode("signin")}
              >
                العودة إلى تسجيل الدخول
              </button>
            )}
          </div>

          <div className="signin-v2-google">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              aria-label="المتابعة باستخدام Google"
            >
              <span
                aria-hidden="true"
                className="signin-v2-google-g"
              >
                G
              </span>
              {busy
                ? "جارٍ الاتصال…"
                : "المتابعة باستخدام Google"}
            </button>
          </div>

          <div className="signin-v2-security">
            <span aria-hidden="true">⌑</span>
            <p>
              لا تشارك كلمة المرور أو رابط الدخول مع أي شخص.
              حافظ على بيانات حسابك آمنة.
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
