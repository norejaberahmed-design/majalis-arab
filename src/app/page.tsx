import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireWorkspace();
  const [entities, sources, claims, pendingRequests] = await Promise.all([
    prisma.tribalEntity.count(),
    prisma.source.count(),
    prisma.historicalClaim.count(),
    prisma.additionRequest.count({ where: { status: "SUBMITTED" } })
  ]);

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="مجالس العرب - الرئيسية">
          <span className="brand-mark">م</span>
          <span><strong>مجالس العرب</strong><small>البحث الموثق</small></span>
        </Link>
        <span className="phase-label">المرحلة الأولى · أساس الأدلة</span>
      </header>

      <section className="hero">
        <p className="eyebrow">المعرفة تبدأ بالمصدر</p>
        <h1>لا نثبت روايةً بلا دليل.</h1>
        <p className="intro">مساحة بحث لتنظيم الأسماء والعلاقات والمراجع التاريخية، مع إظهار ما تدعمه الأدلة وما يزال محل بحث.</p>
        <div className="hero-actions">
          <Link className="primary-button" href="/entities">استعراض الكيانات</Link>
          <Link className="secondary-button" href="/sources">سجل المصادر</Link>
        </div>
      </section>

      <section className="stats" aria-label="إحصاءات قاعدة البيانات">
        <article><span>الكيانات المسجلة</span><strong>{entities}</strong><small>من قاعدة البيانات</small></article>
        <article><span>المصادر</span><strong>{sources}</strong><small>مراجع موثقة في السجل</small></article>
        <article><span>الادعاءات التاريخية</span><strong>{claims}</strong><small>مع حالات المراجعة</small></article>
        <article><span>طلبات الإضافة</span><strong>{pendingRequests}</strong><small>بانتظار الفرز الأولي</small></article>
      </section>

      <section className="work-grid">
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">01</span><div><h2>الكيانات والعلاقات</h2><p>سجّل الأسماء والفروع والعلاقات دون افتراض صحتها مسبقًا.</p></div></div>
          <Link href="/entities" className="text-link">فتح سجل الكيانات ←</Link>
        </article>
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">02</span><div><h2>المصادر والأدلة</h2><p>اربط كل مقطع بمصدره وصفحته، وميّز بين النص المستخرج والمراجع بشريًا.</p></div></div>
          <Link href="/sources" className="text-link">فتح سجل المصادر ←</Link>
        </article>
        <article className="panel">
          <div className="panel-heading"><span className="panel-icon">03</span><div><h2>الادعاءات المتعارضة</h2><p>احتفظ بالأدلة المؤيدة والمناقضة، ولا تجعل الادعاء مثبتًا تلقائيًا.</p></div></div>
          <Link href="/claims" className="text-link">مراجعة الادعاءات ←</Link>
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