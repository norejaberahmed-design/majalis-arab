import Link from "next/link";
import WorkspaceActions from "@/app/workspace-actions";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";
import { roleAtLeast } from "@/lib/workspace";
import EntityForm from "./entity-form";
import EntityWorkspaceNote from "./entity-workspace-note";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  TRIBE: "قبيلة", CLAN: "فرع", FAMILY: "أسرة",
  PERSON: "شخص", PLACE: "مكان", OTHER: "نوع آخر"
};

export default async function EntitiesPage() {
  const workspace = await requireWorkspace();
  const canEditNotes = roleAtLeast(workspace.role, "EDITOR");
  const entities = await prisma.tribalEntity.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      kind: true,
      summary: true,
      updatedAt: true,
      claims: { select: { id: true, status: true } }
    }
  });

  const workspaceNotes = entities.length
    ? await prisma.workspaceEntityNote.findMany({
        where: { workspaceId: workspace.workspaceId, entityId: { in: entities.map(entity => entity.id) } },
        select: { entityId: true, note: true }
      })
    : [];
  const noteByEntity = new Map(workspaceNotes.map(item => [item.entityId, item.note]));

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>سجل الكيانات</small></span></Link>
        <div className="workspace-actions"><Link href="/" className="secondary-button">الرئيسية</Link><WorkspaceActions /></div>
      </header>
      <section className="page-intro">
        <p className="eyebrow">السجل البحثي</p>
        <h1>الكيانات</h1>
        <p className="intro">هذا كتالوج بحثي مشترك للقراءة عبر مساحات العمل، وليس سجلًا خاصًا بمساحة واحدة. وجود كيان لا يعني توثيق نسب أو رواية عنه.</p>
      </section>
      <div className="entity-layout">
        <section className="panel list-panel">
          <div className="list-heading"><h2>السجلات الحالية</h2><span className="count-pill">{entities.length}</span></div>
          {entities.length === 0 ? (
            <div className="empty-state"><strong>لا توجد سجلات بعد</strong><p>لم نضف بيانات افتراضية. يلزم اعتماد صلاحيات الكتالوج المشترك قبل نشر سجلات جديدة.</p></div>
          ) : (
            <div className="entity-list">
              {entities.map(entity => (
                <article className="entity-row" key={entity.id}>
                  <div className="entity-record-summary">
                    <h3>{entity.name}</h3>
                    <p>{entity.summary || "لا يوجد ملخص موثق بعد."}</p>
                    <small>{labels[entity.kind] ?? "نوع غير محدد"} · {entity.claims.length} ادعاء مرتبط</small>
                  </div>
                  <div className="entity-record-meta">
                    <span className="status-label">سجل أولي</span>
                    <EntityWorkspaceNote entityId={entity.id} initialNote={noteByEntity.get(entity.id) ?? null} canEdit={canEditNotes} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <EntityForm />
      </div>
      <section className="unknowns compact-unknowns"><strong>ما لا نعرفه بعد</strong><p>لا تُعرض هنا شجرة أنساب أو علاقات مستنتجة تلقائيًا. يلزم تسجيل المصدر والأدلة ومراجعتها قبل تقييم أي ادعاء.</p></section>
    </main>
  );
}
