import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const kindLabels: Record<string, string> = {
  TRIBE: "قبيلة", CLAN: "فرع", FAMILY: "أسرة", PERSON: "شخص", PLACE: "مكان", OTHER: "كيان"
};
const claimLabels: Record<string, string> = {
  UNREVIEWED: "غير مراجع", UNDER_REVIEW: "قيد المراجعة", SUPPORTED: "مدعوم بعد المراجعة",
  DISPUTED: "متعارض", REJECTED: "مرفوض"
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requireWorkspace();
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 100) : "";

  const [entities, claims, sources, passages, places] = query ? await Promise.all([
    prisma.tribalEntity.findMany({
      where: { OR: [{ name: { contains: query } }, { normalizedName: { contains: query } }, { summary: { contains: query } }] },
      orderBy: { name: "asc" }, take: 20,
      select: { id: true, name: true, kind: true, summary: true, _count: { select: { claims: true, passages: true } } }
    }),
    prisma.historicalClaim.findMany({
      where: { OR: [
        { statement: { contains: query } },
        { entity: { is: { name: { contains: query } } } },
        { source: { is: { title: { contains: query } } } },
        { supportingPassages: { some: { passageText: { contains: query } } } },
        { contradictingPassages: { some: { passageText: { contains: query } } } }
      ] },
      orderBy: { updatedAt: "desc" }, take: 20,
      select: {
        id: true, statement: true, status: true, reviewedByHuman: true,
        entity: { select: { id: true, name: true } },
        source: { select: { id: true, title: true } },
        supportingPassages: { take: 3, select: { id: true, pageLabel: true, locator: true, source: { select: { id: true, title: true } } } },
        contradictingPassages: { take: 3, select: { id: true, pageLabel: true, locator: true, source: { select: { id: true, title: true } } } }
      }
    }),
    prisma.source.findMany({
      where: { OR: [
        { title: { contains: query } }, { author: { contains: query } }, { publisher: { contains: query } },
        { passages: { some: { passageText: { contains: query } } } },
        { claims: { some: { statement: { contains: query } } } }
      ] },
      orderBy: { title: "asc" }, take: 20,
      select: { id: true, title: true, author: true, publisher: true, publicationYear: true, accessStatus: true, humanReviewed: true, _count: { select: { passages: true, claims: true } } }
    }),
    prisma.evidencePassage.findMany({
      where: { OR: [
        { passageText: { contains: query } },
        { source: { is: { title: { contains: query } } } },
        { entity: { is: { name: { contains: query } } } }
      ] },
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, passageText: true, pageLabel: true, locator: true, reviewedByHuman: true, source: { select: { id: true, title: true } }, entity: { select: { id: true, name: true } } }
    }),
    prisma.place.findMany({
      where: { OR: [
        { name: { contains: query } }, { country: { contains: query } }, { region: { contains: query } }, { description: { contains: query } },
        { entity: { is: { name: { contains: query } } } },
        { source: { is: { title: { contains: query } } } },
        { evidencePassage: { is: { passageText: { contains: query } } } }
      ] },
      orderBy: { updatedAt: "desc" }, take: 20,
      select: { id: true, name: true, country: true, region: true, description: true, entity: { select: { id: true, name: true } }, source: { select: { id: true, title: true } }, evidencePassage: { select: { pageLabel: true, locator: true, reviewedByHuman: true } } }
    })
  ]) : [[], [], [], [], []];

  const total = entities.length + claims.length + sources.length + passages.length + places.length;

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/research" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>البحث في السجل الموثق</small></span></Link>
        <div className="hero-actions"><Link href="/entities" className="secondary-button">الكيانات</Link><Link href="/sources" className="secondary-button">المصادر</Link></div>
      </header>
      <section className="page-intro">
        <p className="eyebrow">اسم · رواية · مصدر · موضع</p>
        <h1>البحث في مجالس العرب</h1>
        <p className="intro">ابحث في أسماء القبائل والفروع والأشخاص، ونصوص الروايات، ومقاطع الكتب، والادعاءات والأماكن. كل نتيجة تقود إلى سجلها ومصدرها إن كان مسجلًا.</p>
      </section>
      <section className="entity-form">
        <h2>بحث موحد</h2>
        <form method="get" action="/search">
          <label htmlFor="global-query">اكتب الاسم أو العبارة أو عنوان المصدر</label>
          <input id="global-query" name="q" type="search" maxLength={100} defaultValue={query} autoFocus placeholder="مثال: اسم قبيلة أو نص من كتاب" />
          <div className="hero-actions"><button className="primary-button" type="submit">ابحث في السجل</button><Link className="secondary-button" href="/search">مسح البحث</Link></div>
        </form>
        <p className="muted">تُعرض حتى 20 نتيجة لكل فئة. النتائج تعتمد على السجلات الموجودة، ولا يعني ظهور رواية أنها مثبتة.</p>
      </section>
      {!query ? (
        <section className="unknowns"><strong>ابدأ بعبارة بحث</strong><p>لن نعرض نتائج مصطنعة أو نضيف أسماء تاريخية من عندنا. اكتب كلمة أو عبارة للبحث في قاعدة البيانات الحالية.</p></section>
      ) : total === 0 ? (
        <section className="panel"><div className="empty-state"><strong>لا توجد نتائج مطابقة لـ «{query}»</strong><p>جرّب تهجئة أخرى أو جزءًا من الاسم أو العبارة.</p></div></section>
      ) : (
        <>
          <section className="stats" aria-label="عدد نتائج البحث حسب الفئة">
            <article><span>الكيانات</span><strong>{entities.length}</strong></article>
            <article><span>الروايات والادعاءات</span><strong>{claims.length}</strong></article>
            <article><span>المصادر</span><strong>{sources.length}</strong></article>
            <article><span>مقاطع النصوص</span><strong>{passages.length}</strong></article>
            <article><span>الأماكن</span><strong>{places.length}</strong></article>
          </section>
          {entities.length > 0 && <section className="panel list-panel">
            <div className="list-heading"><h2>الأسماء والكيانات</h2><span className="count-pill">{entities.length}</span></div>
            <div className="entity-list">{entities.map(item => <article className="entity-row" key={item.id}>
              <div><h3><Link className="text-link" href={`/entities/${item.id}`}>{item.name} ←</Link></h3><p>{kindLabels[item.kind] ?? item.kind} · {item._count.claims} ادعاء · {item._count.passages} مقطع دليل</p>{item.summary && <p>{item.summary}</p>}</div>
            </article>)}</div>
          </section>}
          {claims.length > 0 && <section className="panel list-panel">
            <div className="list-heading"><h2>الروايات والادعاءات</h2><span className="count-pill">{claims.length}</span></div>
            <div className="entity-list">{claims.map(item => <article className="entity-row" key={item.id}>
              <div><h3>{item.statement}</h3><p>الحالة: {claimLabels[item.status] ?? item.status} · مراجعة بشرية: {item.reviewedByHuman ? "مسجلة" : "غير مسجلة"}</p>
                {item.entity && <p>الكيان: <Link className="text-link" href={`/entities/${item.entity.id}`}>{item.entity.name}</Link></p>}
                {item.source && <p>المصدر المباشر: <Link className="text-link" href={`/sources/${item.source.id}`}>{item.source.title}</Link></p>}
                {[...item.supportingPassages, ...item.contradictingPassages].map(p => <p key={p.id}><Link className="text-link" href={`/sources/${p.source.id}`}>{p.source.title}</Link> · {p.pageLabel || p.locator || "موضع غير محدد"}</p>)}
              </div><span className={item.status === "DISPUTED" ? "status-label pending" : "status-label"}>{claimLabels[item.status] ?? item.status}</span>
            </article>)}</div>
          </section>}
          {sources.length > 0 && <section className="panel list-panel">
            <div className="list-heading"><h2>المصادر</h2><span className="count-pill">{sources.length}</span></div>
            <div className="entity-list">{sources.map(item => <article className="entity-row" key={item.id}>
              <div><h3><Link className="text-link" href={`/sources/${item.id}`}>{item.title} ←</Link></h3><p>{[item.author, item.publisher, item.publicationYear].filter(Boolean).join(" · ") || "بيانات ببليوغرافية غير مكتملة"}</p><small>{item._count.passages} مقطع · {item._count.claims} ادعاء · {item.humanReviewed ? "المصدر مراجع" : "لم يراجع المصدر بشريًا"}</small></div>
            </article>)}</div>
          </section>}
          {passages.length > 0 && <section className="panel list-panel">
            <div className="list-heading"><h2>مقاطع النصوص والأدلة</h2><span className="count-pill">{passages.length}</span></div>
            <div className="entity-list">{passages.map(item => <article className="entity-row" key={item.id}>
              <div><h3><Link className="text-link" href={`/sources/${item.source.id}`}>{item.source.title} ←</Link></h3><small>{item.pageLabel || item.locator || "موضع غير محدد"} · {item.reviewedByHuman ? "مراجع بشريًا" : "غير مراجع بشريًا"}</small>
                {item.entity && <p>الكيان المرتبط: <Link className="text-link" href={`/entities/${item.entity.id}`}>{item.entity.name}</Link></p>}
                <blockquote>{item.passageText}</blockquote>
              </div><span className={item.reviewedByHuman ? "status-label" : "status-label pending"}>{item.reviewedByHuman ? "مراجع" : "غير مراجع"}</span>
            </article>)}</div>
          </section>}
          {places.length > 0 && <section className="panel list-panel">
            <div className="list-heading"><h2>الأماكن</h2><span className="count-pill">{places.length}</span></div>
            <div className="entity-list">{places.map(item => <article className="entity-row" key={item.id}>
              <div><h3>{item.name}</h3><p>{[item.country, item.region].filter(Boolean).join(" · ") || "لم تسجل الدولة أو المنطقة"}</p>
                {item.description && <p>{item.description}</p>}
                {item.entity && <p>الكيان: <Link className="text-link" href={`/entities/${item.entity.id}`}>{item.entity.name}</Link></p>}
                {item.source && <p>المصدر: <Link className="text-link" href={`/sources/${item.source.id}`}>{item.source.title}</Link> · {item.evidencePassage?.pageLabel || item.evidencePassage?.locator || "موضع غير محدد"}</p>}
              </div>
            </article>)}</div>
          </section>}
        </>
      )}
      <section className="unknowns compact-unknowns"><strong>نزاهة البحث</strong><p>النتيجة هي تطابق نصي مع سجل موجود، وليست حكمًا على صحة الرواية. قد تتعارض المصادر؛ تُعرض حالة الادعاء ومراجعته ولا تُخفى الروايات المخالفة.</p></section>
    </main>
  );
}
