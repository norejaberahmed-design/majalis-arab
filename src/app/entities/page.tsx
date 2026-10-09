import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/validation";
import { requireWorkspace } from "@/lib/current-user";
import EntitySearchPanel from "./entity-search-panel";
import TribeCreateForm from "./tribe-create-form";

export const dynamic = "force-dynamic";

export default async function EntitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireWorkspace();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const normalizedQuery = normalizeName(query);

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
      <section className="unknowns compact-unknowns"><strong>ما لا نعرفه بعد</strong><p>العلاقات قد تمثل نسبًا أو حلفًا أو جوارًا أو هجرة أو رواية تاريخية. لا تُدمج هذه الأنواع ولا تُعامل بوصفها حقائق ثابتة دون دليل ومراجعة.</p></section>
    </main>
  );
}
