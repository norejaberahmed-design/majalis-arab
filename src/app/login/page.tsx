"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "signin" | "signup" | "magic" | "forgot";
type Notice = { kind: "success" | "error"; text: string };

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [revealPassword, setRevealPassword] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    authClient.getSession()
      .then(({ data, error }) => {
        if (active && !error && data?.session) {
          router.replace("/research");
          router.refresh();
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [router]);

  function changeMode(next: Mode) {
    setMode(next);
    setPassword("");
    setRevealPassword(false);
    setNotice(null);
  }

  async function signInWithGoogle() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/research" });
      if (result.error) {
        setNotice({ kind: "error", text: "تعذر بدء الدخول عبر Google. تأكد من إعداد OAuth في الاستضافة ثم حاول مجددًا." });
        setBusy(false);
      }
      // Better Auth redirects the browser to Google's consent/login screen on success.
    } catch {
      setNotice({ kind: "error", text: "تعذر الاتصال بخدمة Google. حاول مجددًا." });
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setNotice({ kind: "error", text: "تحقق من كتابة البريد الإلكتروني بصورة صحيحة." });
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setNotice({ kind: "error", text: "أدخل اسمًا لا يقل عن حرفين." });
      return;
    }
    if ((mode === "signin" || mode === "signup") && !password) {
      setNotice({ kind: "error", text: "أدخل كلمة المرور للمتابعة." });
      return;
    }
    if (mode === "signup" && password.length < 12) {
      setNotice({ kind: "error", text: "كلمة المرور يجب أن تتكون من 12 حرفًا على الأقل." });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const result = await authClient.signIn.email({
          email: cleanEmail, password, callbackURL: "/research",
        });
        if (result.error) {
          setNotice({ kind: "error", text: "لم نتمكن من تسجيل الدخول. راجع البريد وكلمة المرور، أو أكّد بريدك إذا كان الحساب جديدًا." });
          return;
        }
        router.replace("/research");
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: name.trim(), email: cleanEmail, password, callbackURL: "/research",
        });
        if (result.error) {
          setNotice({ kind: "error", text: "تعذر إنشاء الحساب. قد يكون البريد مستخدمًا بالفعل أو أن البيانات تحتاج إلى مراجعة." });
          return;
        }
        const session = await authClient.getSession();
        if (session.error || !session.data?.session) {
          setNotice({ kind: "error", text: "تعذر إنشاء جلسة الدخول بعد التسجيل. حاول تسجيل الدخول بالبريد وكلمة المرور." });
          return;
        }

        router.replace("/research");
        router.refresh();
        return;
      }

      if (mode === "magic") {
        const result = await authClient.signIn.magicLink({
          email: cleanEmail, callbackURL: "/research",
        });
        if (result.error) {
          setNotice({ kind: "error", text: "تعذر إرسال رابط الدخول. حاول مرة أخرى بعد قليل." });
          return;
        }
        setNotice({ kind: "success", text: "إذا كان بالإمكان إرسال رابط لهذا البريد، فستصلك رسالة. افحص صندوق الوارد والرسائل غير المرغوب فيها." });
        return;
      }

      const result = await authClient.requestPasswordReset({
        email: cleanEmail, redirectTo: "/reset-password",
      });
      if (result.error) {
        setNotice({ kind: "error", text: "تعذر إرسال تعليمات الاستعادة الآن. حاول مرة أخرى لاحقًا." });
        return;
      }
      setNotice({ kind: "success", text: "إذا كان البريد مرتبطًا بحساب، فستصلك تعليمات إعادة تعيين كلمة المرور." });
    } catch {
      setNotice({ kind: "error", text: "تعذر الاتصال بالخدمة. تحقق من اتصالك بالإنترنت وحاول مجددًا." });
    } finally {
      setBusy(false);
    }
  }

  const passwordMode = mode === "signin" || mode === "signup";
  const titles: Record<Mode, string> = {
    signin: "مرحبًا بعودتك",
    signup: "أنشئ حسابك",
    magic: "الدخول عبر البريد",
    forgot: "استعادة كلمة المرور",
  };
  const descriptions: Record<Mode, string> = {
    signin: "أدخل بيانات حسابك للمتابعة إلى مجالس العرب.",
    signup: "حساب واحد يحفظ مشاركاتك ومصادرك ومجالسك.",
    magic: "نرسل لك رابط دخول آمنًا إلى بريدك الإلكتروني.",
    forgot: "أدخل البريد المرتبط بحسابك لاستلام تعليمات الاستعادة.",
  };

  if (checkingSession) {
    return <main className="signin-v2-page" dir="rtl"><div className="signin-v2-loading"><span className="signin-v2-mark">م</span><span>جارٍ التحقق من الجلسة…</span></div></main>;
  }

  return (
    <main className="signin-v2-page" dir="rtl">
      <aside className="signin-v2-aside">
        <Link href="/" className="signin-v2-brand">
          <span className="signin-v2-mark">م</span>
          <span><strong>مجالس العرب</strong><small>المعرفة تبدأ بالمصدر</small></span>
        </Link>
        <div className="signin-v2-intro">
          <span className="signin-v2-overline"><i /> مساحة للمعرفة الموثقة</span>
          <h1>لكل رواية<br /><em>مصدر يستحق أن يُقرأ.</em></h1>
          <p>اكتشف التاريخ، اجمع المراجع، وشارك في نقاش يحترم الدليل واختلاف الروايات.</p>
          <ul>
            <li><span>✓</span><div><strong>مراجع يمكن الرجوع إليها</strong><small>اربط المعلومات بمصادرها قدر الإمكان.</small></div></li>
            <li><span>✓</span><div><strong>مساهماتك في مكان واحد</strong><small>تابع مشاركاتك ومجالسك من حسابك.</small></div></li>
            <li><span>✓</span><div><strong>دخول آمن</strong><small>تحكم في حسابك ببريدك الإلكتروني.</small></div></li>
          </ul>
        </div>
        <p className="signin-v2-footnote">مجالس العرب <b>·</b> المعرفة مسؤولية مشتركة</p>
      </aside>

      <section className="signin-v2-main">
        <div className="signin-v2-mobile-brand"><span className="signin-v2-mark">م</span><strong>مجالس العرب</strong></div>
        <div className="signin-v2-card">
          <header className="signin-v2-heading">
            <span>{mode === "signup" ? "انضم إلى المجتمع" : mode === "forgot" ? "استعادة آمنة" : "مساحتك المعرفية"}</span>
            <h2>{titles[mode]}</h2>
            <p>{descriptions[mode]}</p>
          </header>

          {(mode === "signin" || mode === "signup") && (
            <div className="signin-v2-switch" role="tablist" aria-label="خيارات الحساب">
              <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "selected" : ""} onClick={() => changeMode("signin")}>تسجيل الدخول</button>
              <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "selected" : ""} onClick={() => changeMode("signup")}>إنشاء حساب</button>
            </div>
          )}

          <form className="signin-v2-form" onSubmit={submit} aria-busy={busy}>
            {mode === "signup" && <label className="signin-v2-field"><span>الاسم</span><input type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="اسمك الذي سيظهر في المجلس" minLength={2} maxLength={80} required disabled={busy} /></label>}
            <label className="signin-v2-field"><span>البريد الإلكتروني</span><input type="email" dir="ltr" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" maxLength={254} required disabled={busy} /></label>
            {passwordMode && <label className="signin-v2-field"><span>كلمة المرور</span><div className="signin-v2-password"><input type={revealPassword ? "text" : "password"} dir="ltr" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "12 حرفًا على الأقل" : "أدخل كلمة المرور"} minLength={mode === "signup" ? 12 : undefined} maxLength={128} required disabled={busy} /><button type="button" onClick={() => setRevealPassword(v => !v)} disabled={busy}>{revealPassword ? "إخفاء" : "إظهار"}</button></div></label>}
            {mode === "signin" && <div className="signin-v2-forgot"><button type="button" onClick={() => changeMode("forgot")}>نسيت كلمة المرور؟</button></div>}
            {notice && <div className={`signin-v2-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-live="polite"><span>{notice.kind === "success" ? "✓" : "!"}</span><p>{notice.text}</p></div>}
            <button type="submit" className="signin-v2-submit" disabled={busy}>{busy ? <><i /> جارٍ المعالجة…</> : mode === "signin" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء الحساب" : mode === "magic" ? "إرسال رابط الدخول" : "إرسال تعليمات الاستعادة"}{!busy && <span aria-hidden="true">←</span>}</button>
          </form>

          <div className="signin-v2-bottom">
            {mode === "signin" && <p>ليس لديك حساب؟ <button type="button" onClick={() => changeMode("signup")}>أنشئ حسابًا جديدًا</button></p>}
            {mode === "signup" && <p>لديك حساب بالفعل؟ <button type="button" onClick={() => changeMode("signin")}>سجّل الدخول</button></p>}
            {mode === "signin" && <button type="button" className="signin-v2-magic" onClick={() => changeMode("magic")}>الدخول برابط يُرسل إلى بريدك الإلكتروني</button>}
            {(mode === "magic" || mode === "forgot") && <button type="button" onClick={() => changeMode("signin")}>العودة إلى تسجيل الدخول</button>}
          </div>
          <div className="signin-v2-google">
            <button type="button" onClick={signInWithGoogle} disabled={busy} aria-label="المتابعة باستخدام Google">
              <span aria-hidden="true" className="signin-v2-google-g">G</span>
              {busy ? "جارٍ تحويلك إلى Google…" : "المتابعة باستخدام Google"}
            </button>
          </div>
          <div className="signin-v2-security"><span aria-hidden="true">⌑</span><p>لا تشارك كلمة المرور أو رابط الدخول مع أي شخص. سنستخدم بريدك لتأكيد الحساب وتأمينه.</p></div>
        </div>
        <p className="signin-v2-legal">بالمتابعة، أنت تنضم إلى مجتمع يقوم على التوثيق واحترام اختلاف الروايات.</p>
      </section>
    </main>
  );
}
