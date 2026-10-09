import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireWorkspace();
  const [entities, sources, claims, passages, places] = await Promise.all([
    prisma.tribalEntity.count(),
    prisma.source.count(),
    prisma.historicalClaim.count(),
    prisma.evidencePassage.count(),
    prisma.place.count()
  ]);

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/council" className="brand" aria-label="مجالس العرب - المجلس">
          <span className="brand-mark">م</span>
          <span><strong>مجالس العرب</strong><small>البحث الموثق</small></span>
        </Link>
      </header>

      <section className="hero">
        <p className="eyebrow">المراجع أولًا</p>
        <h1>الدليل البحثي لمجالس العرب.</h1>
        <p className="intro">سجل الكيانات والمصادر والادعاءات التاريخية. نعرض ما هو مسجل فعليًا ونفصل بين وجود الرواية وبين ثبوتها بالدليل.</p>
        <div className="hero-actions">
          <Link className="primary-button" href="/council">العودة إلى المجلس</Link>
          <Link className="secondary-button" href="/tribe">ملف قبيلتي</Link>
          <Link className="secondary-button" href="/search">البحث الموحد</Link>
          <Link className="secondary-button" href="/entities">استعراض الكيانات</Link>
        </div>
      </section>

      <section className="stats" aria-label="إحصاءات قاعدة البيانات">
        <article><span>الكيانات المسجلة</span><strong>{entities}</strong><small>من قاعدة البيانات</small></article>
        <article><span>المصادر</span><strong>{sources}</strong><small>مراجع مسجلة في قاعدة البيانات</small></article>
        <article><span>الادعاءات التاريخية</span><strong>{claims}</strong><small>مع حالات المراجعة</small></article>
        <article><span>مقاطع الأدلة</span><strong>{passages}</strong><small>مقاطع مسجلة في قاعدة البيانات</small></article>
        <article><span>الأماكن</span><strong>{places}</strong><small>أماكن لها سجلات فعلية</small></article>
      </section>

      <section className="work-grid">
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">01</span><div><h2>المجلس والحوار</h2><p>انشر حديثًا، علّق على الأحاديث، وتفاعل مع أعضاء مساحتك.</p></div></div>
          <Link href="/council" className="text-link">دخول المجلس ←</Link>
        </article>
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">02</span><div><h2>الكيانات والعلاقات</h2><p>دليل بحثي للأسماء والعلاقات دون افتراض صحتها مسبقًا.</p></div></div>
          <Link href="/entities" className="text-link">فتح سجل الكيانات ←</Link>
        </article>
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">02</span><div><h2>المصادر والأدلة</h2><p>اربط كل مقطع بمصدره وصفحته، وميّز بين النص المستخرج والمراجع بشريًا.</p></div></div>
          <Link href="/sources" className="text-link">فتح سجل المصادر ←</Link>
        </article>
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">05</span><div><h2>الأماكن التاريخية</h2><p>سجل الأماكن المرتبطة بمقاطع مصادر مراجعة، دون تخمين المواقع.</p></div></div>
          <Link href="/places" className="text-link">فتح سجل الأماكن ←</Link>
        </article>
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">03</span><div><h2>الادعاءات المتعارضة</h2><p>احتفظ بالأدلة المؤيدة والمناقضة، ولا تجعل الادعاء مثبتًا تلقائيًا.</p></div></div>
          <Link href="/claims" className="text-link">مراجعة الادعاءات ←</Link>
        </article>
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">04</span><div><h2>طلبات الإضافة</h2><p>تابع اقتراحات الكيانات وملاحظات المراجعة داخل مساحة العمل.</p></div></div>
          <Link href="/requests" className="text-link">فتح طلبات الإضافة ←</Link>
        </article>
      </section>

      <section className="unknowns">
        <div><p className="eyebrow">قاعدة النزاهة البحثية</p><h2>ما لا نعرفه بعد</h2></div>
        <p>لم تُضف بيانات تاريخية أو أنساب افتراضية إلى قاعدة البيانات. الأعداد أعلاه تُقرأ من قاعدة البيانات الفعلية؛ والصفر يعني عدم وجود سجلات بعد، لا أن الموضوع غير موجود تاريخيًا.</p>
      </section>

      <footer><span>مجالس العرب</span><span>كل رواية تحتاج مصدرًا، وكل استنتاج يحتاج مراجعة.</span></footer>
    </main>
  );
}