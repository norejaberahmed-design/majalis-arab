import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireWorkspace();

  const tribes = await prisma.tribalEntity.findMany({
    where: { kind: "TRIBE" },
    orderBy: { name: "asc" },
    take: 12,
    select: { id: true, name: true, summary: true }
  });

  return (
    <main className="shell tribe-home">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark">م</span>
          <span><strong>مجالس العرب</strong><small>معرفة القبائل ومجالسها</small></span>
        </Link>
        <Link href="/council" className="secondary-button">المجلس</Link>
      </header>

      <section className="hero tribe-home-hero">
        <p className="eyebrow">دليل القبائل العربية</p>
        <h1>ابحث عن قبيلتك</h1>
        <p className="intro">اكتب اسم القبيلة للعثور على سجلها. إذا لم تجدها، يمكنك اقتراح إضافتها.</p>
        <form action="/entities" className="tribe-home-search">
          <label className="sr-only" htmlFor="tribe-home-query">اسم القبيلة</label>
          <input id="tribe-home-query" name="q" type="search" maxLength={100} placeholder="اكتب اسم القبيلة..." />
          <button className="primary-button" type="submit">بحث</button>
        </form>
        <div className="tribe-home-actions">
          <Link className="secondary-button" href="/entities#add-tribe">＋ اقتراح إضافة قبيلة</Link>
          <Link className="text-link" href="/entities">عرض الفهرس كاملًا ←</Link>
        </div>
      </section>

      <section className="panel tribe-home-list" aria-labelledby="registered-tribes-heading">
        <div className="list-heading">
          <div><h2 id="registered-tribes-heading">القبائل المسجلة</h2><p className="muted">الأسماء المعروضة مأخوذة من قاعدة البيانات الحالية.</p></div>
          <Link className="text-link" href="/entities">عرض الكل ←</Link>
        </div>
        {tribes.length === 0 ? (
          <div className="empty-state">
            <strong>لا توجد قبائل معتمدة في الفهرس حتى الآن</strong>
            <p>يمكنك البحث في مرشحات الأسماء المرتبطة بالمصادر أو اقتراح إضافة اسم جديد.</p>
            <Link className="primary-button" href="/entities#add-tribe">اقتراح إضافة قبيلة</Link>
          </div>
        ) : (
          <div className="entity-list">
            {tribes.map((tribe) => (
              <Link className="entity-row tribe-home-row" href={`/entities/${encodeURIComponent(tribe.id)}`} key={tribe.id}>
                <div><h3>{tribe.name}</h3>{tribe.summary && <p>{tribe.summary}</p>}</div>
                <span aria-hidden="true">←</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <footer className="tribe-home-footer">مجالس العرب · التوثيق بالمصادر، والمراجعة قبل اعتماد المعلومات.</footer>
    </main>
  );
}
