"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type AuthMode = "signin" | "signup" | "magic" | "forgot";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    authClient.getSession()
      .then(({ data, error }) => {
        if (active && !error && data?.session) {
          router.replace("/setup");
          router.refresh();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, [router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setNotice(null);
    setPassword("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setNotice({ type: "error", text: "أدخل بريدًا إلكترونيًا صحيحًا." });
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setNotice({ type: "error", text: "اكتب اسمك كما تريد أن يظهر للآخرين." });
      return;
    }
    if ((mode === "signin" || mode === "signup") && !password) {
      setNotice({ type: "error", text: "أدخل كلمة المرور." });
      return;
    }
    if (mode === "signup" && password.length < 12) {
      setNotice({ type: "error", text: "استخدم كلمة مرور من 12 حرفًا على الأقل." });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const result = await authClient.signIn.email({
          email: normalizedEmail,
          password,
          callbackURL: "/setup",
        });
        if (result.error) {
          setNotice({ type: "error", text: "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور، ثم حاول مجددًا." });
          return;
        }
        router.replace("/setup");
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: normalizedEmail,
          password,
          callbackURL: "/setup",
        });
        if (result.error) {
          setNotice({ type: "error", text: "تعذر إنشاء الحساب بهذه البيانات. تحقق من البريد وحاول مجددًا." });
          return;
        }
        const sessionResult = await authClient.getSession();
        if (!sessionResult.error && sessionResult.data?.session) {
          router.replace("/setup");
          router.refresh();
          return;
        }
        setNotice({
          type: "success",
          text: "تم استلام طلب إنشاء الحساب. افحص بريدك الإلكتروني واضغط رابط التحقق لإكمال التسجيل.",
        });
        return;
      }

      if (mode === "magic") {
        const result = await authClient.signIn.magicLink({
          email: normalizedEmail,
          callbackURL: "/setup",
        });
        if (result.error) {
          setNotice({ type: "error", text: "تعذر إرسال رابط الدخول. حاول مرة أخرى بعد قليل." });
          return;
        }
        setNotice({ type: "success", text: "إذا أمكن إرسال الرابط لهذا البريد، فستصلك رسالة. افحص الوارد والرسائل غير المرغوب فيها." });
        return;
      }

      const result = await authClient.requestPasswordReset({
        email: normalizedEmail,
        redirectTo: "/reset-password",
      });
      if (result.error) {
        setNotice({ type: "error", text: "تعذر إرسال تعليمات الاستعادة الآن. حاول مرة أخرى لاحقًا." });
        return;
      }
      setNotice({ type: "success", text: "إذا كان البريد مرتبطًا بحساب، فستصلك رسالة لإعادة تعيين كلمة المرور." });
    } catch {
      setNotice({ type: "error", text: "تعذر الاتصال بالخدمة. تحقق من اتصالك وحاول مجددًا." });
    } finally {
      setBusy(false);
    }
  }

  const isPasswordMode = mode === "signin" || mode === "signup";
  const title = mode === "signin" ? "مرحبًا بعودتك" : mode === "signup" ? "أنشئ حسابك" : mode === "magic" ? "الدخول برابط البريد" : "استعادة الحساب";
  const subtitle = mode === "signin"
    ? "سجّل الدخول لمتابعة مجالسك ومصادرك المحفوظة."
    : mode === "signup"
      ? "أنشئ حسابًا واحدًا لحفظ مساهماتك ومتابعة مجالسك."
      : mode === "magic"
        ? "سنرسل إلى بريدك رابط دخول آمنًا صالحًا لمدة 10 دقائق."
        : "أدخل بريدك وسنرسل تعليمات إعادة تعيين كلمة المرور.";

  if (checkingSession) {
    return (
      <main className="auth-page" dir="rtl">
        <div className="auth-loading"><span className="auth-emblem">م</span><span>جارٍ التحقق من حسابك…</span></div>
      </main>
    );
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-story" aria-label="عن مجالس العرب">
        <Link href="/" className="auth-story-brand">
          <span className="auth-emblem">م</span>
          <span><strong>مجالس العرب</strong><small>المعرفة تبدأ بالمصدر</small></span>
        </Link>
        <div className="auth-story-copy">
          <p className="auth-story-kicker"><span /> مساحة للمعرفة الموثقة</p>
          <h1>التاريخ يُروى،<br /><em>والمصادر تُثبت.</em></h1>
          <p className="auth-story-description">اجمع الروايات والمراجع، وتتبّع العلاقات التاريخية، وناقش ما نعرفه وما يحتاج إلى توثيق.</p>
          <div className="auth-principles">
            <div><span className="auth-principle-icon">١</span><span><strong>مصدر قبل الادعاء</strong><small>كل معلومة قابلة للمراجعة والتوثيق.</small></span></div>
            <div><span className="auth-principle-icon">٢</span><span><strong>نقاش يحترم الاختلاف</strong><small>تمييز الرواية عن الحقيقة المثبتة.</small></span></div>
            <div><span className="auth-principle-icon">٣</span><span><strong>مساهماتك محفوظة</strong><small>حساب واحد لمتابعة مشاركاتك.</small></span></div>
          </div>
        </div>
        <p className="auth-story-footer">مجالس العرب <span>·</span> المعرفة مسؤولية مشتركة</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-mobile-brand">
          <span className="auth-emblem">م</span><strong>مجالس العرب</strong>
        </div>
        <div className="auth-panel">
          <div className="auth-panel-heading">
            <p className="auth-panel-eyebrow">{mode === "signup" ? "انضم إلى المجتمع" : mode === "forgot" ? "استعادة آمنة" : "مساحتك المعرفية"}</p>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          {(mode === "signin" || mode === "signup") && (
            <div className="auth-tabs" role="tablist" aria-label="نوع الحساب">
              <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => switchMode("signin")}>تسجيل الدخول</button>
              <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>إنشاء حساب</button>
            </div>
          )}

          <form className="auth-form" onSubmit={submit} aria-busy={busy}>
            {mode === "signup" && (
              <label className="auth-field">
                <span>الاسم</span>
                <input autoComplete="name" type="text" value={name} onChange={event => setName(event.target.value)} placeholder="الاسم الذي سيظهر في المجلس" minLength={2} maxLength={80} required disabled={busy} />
              </label>
            )}
            <label className="auth-field">
              <span>البريد الإلكتروني</span>
              <input autoComplete="email" inputMode="email" dir="ltr" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" maxLength={254} required disabled={busy} />
            </label>
            {isPasswordMode && (
              <label className="auth-field">
                <span>كلمة المرور</span>
                <span className="auth-password-control">
                  <input autoComplete={mode === "signup" ? "new-password" : "current-password"} dir="ltr" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === "signup" ? "12 حرفًا على الأقل" : "أدخل كلمة المرور"} minLength={mode === "signup" ? 12 : undefined} maxLength={128} required disabled={busy} />
                  <button type="button" className="auth-reveal" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} disabled={busy}>{showPassword ? "إخفاء" : "إظهار"}</button>
                </span>
              </label>
            )}

            {mode === "signin" && (
              <div className="auth-form-links">
                <button type="button" onClick={() => switchMode("forgot")}>نسيت كلمة المرور؟</button>
              </div>
            )}

            {notice && (
              <div className={`auth-notice ${notice.type}`} role={notice.type === "error" ? "alert" : "status"} aria-live="polite">
                <span aria-hidden="true">{notice.type === "success" ? "✓" : "!"}</span>
                <p>{notice.text}</p>
              </div>
            )}

            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? <><span className="auth-spinner" /> جارٍ المعالجة…</> : mode === "signin" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء الحساب" : mode === "magic" ? "إرسال رابط الدخول" : "إرسال رابط الاستعادة"}
              {!busy && <span aria-hidden="true">←</span>}
            </button>
          </form>

          <div className="auth-alternatives">
            {mode === "signin" && <p>ليس لديك حساب؟ <button type="button" onClick={() => switchMode("signup")}>أنشئ حسابًا جديدًا</button></p>}
            {mode === "signup" && <p>لديك حساب بالفعل؟ <button type="button" onClick={() => switchMode("signin")}>سجّل الدخول</button></p>}
            {mode === "signin" && <button className="auth-magic-link" type="button" onClick={() => switchMode("magic")}>أو الدخول برابط يُرسل إلى بريدك</button>}
            {(mode === "magic" || mode === "forgot") && <button className="auth-back-link" type="button" onClick={() => switchMode("signin")}>العودة إلى تسجيل الدخول</button>}
          </div>

          <div className="auth-security-note"><span aria-hidden="true">⌑</span><p>نحافظ على أمان حسابك. لا تشارك كلمة المرور أو روابط الدخول مع أي شخص.</p></div>
        </div>
        <p className="auth-legal">بمتابعة الدخول، تساهم في مجتمع يقوم على التوثيق واحترام اختلاف الروايات.</p>
      </section>
    </main>
  );
}
