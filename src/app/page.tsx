import Link from "next/link";
import { requireWorkspace } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workspace = await requireWorkspace();

  return (
    <main className="shell tribe-home">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark">م</span>
          <span><strong>مجالس العرب</strong><small>ذاكرة التاريخ العربي</small></span>
        </Link>
        <div className="workspace-actions">
          <span aria-label="مساحة العمل الحالية">{workspace.workspace.name}</span>
          <Link href="/council">المجلس</Link>
        </div>
      </header>

      <section className="page-intro tribe-home-intro">
        <p className="eyebrow">دليل القبائل العربية</p>
        <h1>ابحث عن قبيلتك</h1>
        <p className="intro">اكتب اسم القبيلة للوصول إلى سجلها ومعلوماتها ومجلسها. إذا لم تجدها، يمكنك اقتراح إضافتها للمراجعة.</p>
      </section>

      <section className="home-search-panel tribe-home-search" aria-label="البحث عن قبيلة">
        <div className="home-search-heading">
          <div><strong>ما اسم القبيلة التي تبحث عنها؟</strong><p>ابحث بالاسم الكامل أو بجزء منه.</p></div>
          <span aria-hidden="true">⌕</span>
        </div>
        <form action="/entities" className="home-search-form">
          <span aria-hidden="true">⌕</span>
          <input name="q" type="search" maxLength={100} required placeholder="اكتب اسم القبيلة..." aria-label="اسم القبيلة" />
          <button type="submit">ابحث</button>
        </form>
        <p className="tribe-home-hint">إذا لم تظهر نتيجة مطابقة، ستجد في صفحة البحث نموذجًا لاقتراح إضافة القبيلة. سيخضع الطلب للمراجعة قبل اعتماده.</p>
      </section>

      <div className="tribe-home-links">
        <Link className="secondary-button" href="/entities">استعراض سجل القبائل</Link>
        <Link className="secondary-button" href="/council">دخول المجلس</Link>
      </div>

      <footer className="home-footer">
        <span>مجالس العرب ©</span>
        <span>ذاكرة عربية تُبنى بالمصادر والمراجعة</span>
      </footer>
    </main>
  );
}
