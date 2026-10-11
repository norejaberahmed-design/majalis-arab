import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="signin-v2-page" dir="rtl">
          <div className="signin-v2-loading" role="status" aria-live="polite">
            <span className="signin-v2-mark">م</span>
            <span>جارٍ تحميل صفحة الدخول…</span>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
