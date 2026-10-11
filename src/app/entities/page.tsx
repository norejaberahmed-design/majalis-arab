import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/validation";
import { requireWorkspace } from "@/lib/current-user";
import EntitySearchPanel from "./entity-search-panel";
import TribeCreateForm from "./tribe-create-form";
import { searchTribeNameCandidates, tribeNameCandidates } from "@/lib/tribe-name-candidates";

export const dynamic = "force-dynamic";

export default async function EntitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireWorkspace();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const normalizedQuery = normalizeName(query);
  const sourceCandidates = searchTribeNameCandidates(query, 24);

  const records = await prisma.tribalEntity.findMany({
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
      _count: { select: { claims: true, passages: true, outgoing: true, incoming: true } }
    }
  });
  const entities = records.map(entity => ({
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    summary: entity.summary,
    claimsCount: entity._count.claims,
    passagesCount: entity._count.passages,
    relationshipsCount: entity._count.outgoing + entity._count.incoming
  }));

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/research" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>دليل الكيانات القبلية</small></span></Link>
        <Link href="/sources" className="secondary-button">المصادر والأدلة</Link>
      </header>
      <EntitySearchPanel initialEntities={entities} initialQuery={query} />
      <TribeCreateForm />
      <section className="panel list-panel" aria-labelledby="source-candidate-heading">
        <div className="list-heading">
          <div><h2 id="source-candidate-heading">فهرس الأسماء من المصادر</h2><p className="muted">هذه مرشحات فهرسة من 8 دفعات موثقة المصدر، وليست قائمة قبائل مؤكدة.</p></div>
          <span className="count-pill">{tribeNameCandidates.length} سجلًا</span>
        </div>
        {query && <p className="muted">نتائج مطابقة لعبارة «{query}» — يعرض الفهرس حتى 24 نتيجة، ولا يدمج الأسماء المتشابهة تلقائيًا.</p>}
        {sourceCandidates.length === 0 ? (
          <div className="empty-state"><strong>لا توجد أسماء مرشحة مطابقة</strong><p>جرّب جزءًا آخر من الاسم أو افتح المصدر للبحث يدويًا.</p></div>
        ) : (
          <div className="entity-list">{sourceCandidates.map(candidate => {
            const kindLabel = candidate.entityKind === "TRIBE" ? "قبيلة مرشحة"
              : candidate.entityKind === "TRIBAL_GROUP" ? "مجموعة قبلية مرشحة"
              : candidate.entityKind === "CLAN_OR_SUBTRIBE" ? "بطن أو فرع مرشح"
              : candidate.entityKind === "UNRESOLVED" ? "نوع الكيان غير محسوم"
              : "مرشح يحتاج تصنيفًا";
            return <article className="entity-row" key={candidate.id}>
              <div>
                <h3>{candidate.name}</h3>
                <p>{kindLabel} · <span className="status-label pending">غير مراجع بشريًا</span></p>
                {candidate.evidence ? <p>{candidate.evidence}</p> : <p className="muted">لم يُسجل مقتطف نصي؛ يلزم مراجعة الصفحة الأصلية.</p>}
                {candidate.sourceLocator && <small className="muted">{candidate.sourceLocator}</small>}
                <p><a className="text-link" href={candidate.sourceUrl} target="_blank" rel="noopener noreferrer">فتح المصدر الأصلي ↗</a></p>
              </div>
            </article>;
          })}</div>
        )}
      </section>
      <section className="unknowns compact-unknowns"><strong>ما لا نعرفه بعد</strong><p>العلاقات قد تمثل نسبًا أو حلفًا أو جوارًا أو هجرة أو رواية تاريخية. لا تُدمج هذه الأنواع ولا تُعامل بوصفها حقائق ثابتة دون دليل ومراجعة.</p></section>
    </main>
  );
}
