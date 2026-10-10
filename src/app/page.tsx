import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workspace = await requireWorkspace();
  const [tribes, sources, claims, passages, places, posts] = await Promise.all([
    prisma.tribalEntity.count(),
    prisma.source.count(),
    prisma.historicalClaim.count(),
    prisma.evidencePassage.count(),
    prisma.place.count(),
    prisma.councilPost.count({ where: { workspaceId: workspace.workspaceId } })
  ]);

  const metrics = [
    { label: "القبائل والكيانات", value: tribes, hint: "سجلات موجودة فعليًا", icon: "⌘", href: "/entities" },
    { label: "المصادر التاريخية", value: sources, hint: "مراجع مفهرسة", icon: "▤", href: "/sources" },
    { label: "الشواهد النصية", value: passages, hint: "مقاطع مرتبطة بمصدر", icon: "❞", href: "/sources" },
    { label: "الادعاءات التاريخية", value: claims, hint: "تحتاج قراءة أدلتها", icon: "◈", href: "/claims" }
  ];

  return (
    <main className="home-app">
      <aside className="home-sidebar">
        <Link href="/" className="home-brand">
          <span className="home-brand-mark">م</span>
          <span><strong>مجالس العرب</strong><small>ذاكرة التاريخ العربي</small></span>
        </Link>
        <p className="home-nav-label">المساحة الرئيسية</p>
        <nav className="home-nav" aria-label="التنقل الرئيسي">
          <Link className="active" href="/"><span>▦</span> نظرة عامة</Link>
          <Link href="/council"><span>◉</span> المجلس والحوار</Link>
          <Link href="/entities"><span>⌘</span> القبائل والكيانات</Link>
          <Link href="/sources"><span>▤</span> المكتبة والمصادر</Link>
          <Link href="/claims"><span>◈</span> الروايات والادعاءات</Link>
          <Link href="/places"><span>⌖</span> الأماكن التاريخية</Link>
          <Link href="/requests"><span>＋</span> طلبات الإضافة</Link>
        </nav>
        <div className="home-sidebar-note">
          <span className="home-note-dot" />
          <div><strong>منهج التوثيق</strong><p>المصدر قبل الاستنتاج. والرواية ليست حقيقة حتى تُراجع.</p></div>
        </div>
        <div className="home-sidebar-footer">نسخة قيد التطوير <span>·</span> لا تزال المراجعة مستمرة</div>
      </aside>

      <section className="home-main">
        <header className="home-topbar">
          <div className="home-breadcrumb">مجالس العرب <span>/</span> نظرة عامة</div>
          <div className="home-workspace"><span className="home-avatar">م</span><span><strong>{workspace.workspace.name}</strong><small>مساحة العمل الحالية</small></span></div>
        </header>

        <div className="home-content">
          <section className="home-welcome">
            <div>
              <p className="home-eyebrow"><span /> منصة المعرفة التاريخية العربية</p>
              <h1>تاريخٌ نبحثه،<br /><em>ومصادرٌ نرجع إليها.</em></h1>
              <p className="home-welcome-copy">استكشف أسماء القبائل والكيانات، وتتبّع الروايات إلى مصادرها الأصلية، وشارك المعرفة مع مجلسك. كل رقم هنا مأخوذ من قاعدة البيانات الفعلية.</p>
              <div className="home-actions">
                <Link className="home-primary" href="/entities">استكشف سجل القبائل <span>←</span></Link>
                <Link className="home-secondary" href="/sources">تصفّح المصادر</Link>
              </div>
            </div>
            <div className="home-emblem" aria-hidden="true">
              <div className="home-emblem-ring ring-one" />
              <div className="home-emblem-ring ring-two" />
              <div className="home-emblem-center"><span>م</span><small>المعرفة<br />بالدليل</small></div>
              <span className="home-star star-a">✳</span><span className="home-star star-b">✧</span>
            </div>
          </section>

          <section className="home-search-panel" aria-label="البحث في الكيانات">
            <div className="home-search-heading"><div><strong>عن ماذا تبحث اليوم؟</strong><p>ابدأ باسم قبيلة أو كيان مسجل في الدليل.</p></div><span>⌕</span></div>
            <form action="/entities" className="home-search-form">
              <span aria-hidden="true">⌕</span>
              <input name="q" type="search" maxLength={100} placeholder="اكتب اسم القبيلة أو الكيان..." aria-label="اسم القبيلة أو الكيان" />
              <button type="submit">ابحث في الدليل</button>
            </form>
          </section>

          <section className="home-section">
            <div className="home-section-heading"><div><p className="home-eyebrow">صورة البيانات الحالية</p><h2>الدليل بالأرقام</h2></div><span className="home-live-label"><i /> من قاعدة البيانات</span></div>
            <div className="home-metrics">
              {metrics.map((metric) => (
                <Link className="home-metric" href={metric.href} key={metric.label}>
                  <div className="home-metric-top"><span className="home-metric-icon">{metric.icon}</span><span className="home-metric-arrow">↗</span></div>
                  <span className="home-metric-label">{metric.label}</span>
                  <strong>{metric.value.toLocaleString("ar-SA")}</strong>
                  <small>{metric.hint}</small>
                </Link>
              ))}
            </div>
          </section>

          <section className="home-lower-grid">
            <div className="home-card home-library-card">
              <div className="home-card-title"><div><p className="home-eyebrow">مراحل المعرفة</p><h2>من الكتاب إلى الدليل</h2></div><span className="home-book-icon">▤</span></div>
              <div className="home-steps">
                <div><span className="home-step-number">١</span><div><strong>فهرسة المصادر</strong><p>تسجيل الكتاب ومؤلفه وبيانات الطبعة والرابط.</p></div><span className="home-step-state">المرحلة الحالية</span></div>
                <div><span className="home-step-number">٢</span><div><strong>استخراج الشواهد</strong><p>حفظ النص مع موضعه ورابط المصدر الأصلي.</p></div></div>
                <div><span className="home-step-number">٣</span><div><strong>مراجعة الأسماء والروايات</strong><p>لا تُعتمد الأسماء أو الأنساب دون مراجعة بشرية.</p></div></div>
              </div>
              <Link className="home-inline-link" href="/sources">الذهاب إلى المكتبة <span>←</span></Link>
            </div>

            <div className="home-card home-community-card">
              <div className="home-card-title"><div><p className="home-eyebrow">مجتمع المعرفة</p><h2>المجلس العربي</h2></div><span className="home-community-icon">◉</span></div>
              <p className="home-community-copy">مساحة للنقاش وتبادل المعرفة بين الأعضاء، مع فصل الحوار عن السجل التاريخي الموثق.</p>
              <div className="home-community-stat"><span>منشورات مساحة العمل</span><strong>{posts.toLocaleString("ar-SA")}</strong></div>
              <div className="home-community-stat"><span>الأماكن المسجلة في الدليل</span><strong>{places.toLocaleString("ar-SA")}</strong></div>
              <Link className="home-community-link" href="/council">دخول المجلس <span>←</span></Link>
            </div>
          </section>

          <section className="home-integrity">
            <div className="home-integrity-mark">✓</div>
            <div><strong>لا نملأ الفراغ بالتخمين</strong><p>الأرقام المعروضة تعكس السجلات الموجودة فقط. إذا ظهر صفر، فهذا يعني أن السجل لم يُضف بعد، وليس أن القبيلة أو الرواية غير موجودة تاريخيًا.</p></div>
            <Link href="/research">عن منهج البحث <span>←</span></Link>
          </section>

          <footer className="home-footer"><span>مجالس العرب ©</span><span>ذاكرة عربية تُبنى بالمصادر والمراجعة</span><Link href="/research">الدليل البحثي</Link></footer>
        </div>
      </section>
    </main>
  );
}
