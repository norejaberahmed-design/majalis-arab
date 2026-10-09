import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/validation";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  TRIBE: "قبيلة", CLAN: "فرع", FAMILY: "أسرة",
  PERSON: "شخص", PLACE: "مكان", OTHER: "نوع آخر"
};

export default async function EntitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const normalizedQuery = normalizeName(query);

  const entities = await prisma.tribalEntity.findMany({
    where: query ? {
      OR: [
        { name: { contains: query } },
        { normalizedName: { contains: normalizedQuery } }
      ]
    } : undefined,
    orderBy: { name: "asc" },
    take: 100,
    select: {
      id: true,
      name: true,
      kind: true,
      summary: true,
      claims: { select: { id: true, status: true } },
      outgoing: { select: { id: true, relationshipType: true } },
      incoming: { select: { id: true, relationshipType: true } },
      passages: { select: { id: true } }
    }
  });

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/research" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>دليل الكيانات القبلية</small></span></Link>
        <Link href="/sources" className="secondary-button">المصادر والأدلة</Link>
      </header>
      <section className="page-intro">
        <p className="eyebrow">قاعدة المعرفة القبلية</p>
        <h1>البحث في الكيانات</h1>
        <p className="intro">تصفح السجلات البحثية المشتركة. وجود اسم في الدليل لا يثبت النسب أو صحة الروايات المرتبطة به؛ افتح الادعاءات والمصادر لفحص الأدلة.</p>
        <form action="/entities" method="get" className="search-form">
          <label htmlFor="q">اسم القبيلة أو الفرع أو المكان</label>
          <div className="search-row">
            <input id="q" name="q" type="search" maxLength={100} defaultValue={query} placeholder="اكتب الاسم بالعربية…" />
            <button type="submit" className="primary-button">بحث</button>
          </div>
        </form>
      </section>
      <section className="panel list-panel">
        <div className="list-heading"><h2>{query ? `نتائج البحث عن «${query}»` : "سجلات الكتالوج"}</h2><span className="count-pill">{entities.length}</span></div>
        {entities.length === 0 ? (
          <div className="empty-state"><strong>{query ? "لا توجد نتائج مطابقة" : "لا توجد سجلات بعد"}</strong><p>{query ? "لا نستنتج معلومات عن الاسم عند غياب سجل موثق. يمكنك تقديم اقتراح إضافة مع مصدر قابل للتحقق بعد تسجيل الدخول." : "لم نضف بيانات قبلية افتراضية. ستظهر السجلات بعد إدخالها ومراجعة مصادرها."}</p></div>
        ) : (
          <div className="entity-list">
            {entities.map(entity => (
              <article className="entity-row" key={entity.id}>
                <div className="entity-record-summary">
                  <h3><Link href={`/entities/${entity.id}`} className="text-link">{entity.name} ←</Link></h3>
                  <p>{entity.summary || "لا يوجد ملخص موثق مسجل لهذا الكيان."}</p>
                  <small>{labels[entity.kind] ?? "نوع غير محدد"} · {entity.claims.length} ادعاء · {entity.passages.length} مقطع دليل · {entity.outgoing.length + entity.incoming.length} علاقة مسجلة</small>
                  <p><Link className="text-link" href="/claims">فحص الادعاءات ←</Link>　<Link className="text-link" href="/sources">تصفح المصادر ←</Link></p>
                </div>
                <span className="status-label">سجل بحثي</span>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="unknowns compact-unknowns"><strong>ما لا نعرفه بعد</strong><p>العلاقات قد تمثل نسبًا أو حلفًا أو جوارًا أو هجرة أو رواية تاريخية. لا تُدمج هذه الأنواع ولا تُعامل بوصفها حقائق ثابتة دون دليل ومراجعة.</p></section>
    </main>
  );
}
