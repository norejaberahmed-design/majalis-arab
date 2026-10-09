import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";
import { roleAtLeast } from "@/lib/workspace";
import EntityWorkspaceNote from "../entity-workspace-note";

export const dynamic = "force-dynamic";

const kindLabels: Record<string, string> = {
  TRIBE: "قبيلة",
  CLAN: "فرع",
  FAMILY: "أسرة",
  PERSON: "شخص",
  PLACE: "مكان",
  OTHER: "نوع آخر"
};

const claimLabels: Record<string, string> = {
  UNREVIEWED: "غير مراجع",
  UNDER_REVIEW: "قيد المراجعة",
  SUPPORTED: "مدعوم بعد المراجعة",
  DISPUTED: "متعارض",
  REJECTED: "مرفوض"
};

export default async function EntityProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await requireWorkspace();
  const { id } = await params;
  if (!id || id.length > 64) notFound();

  const entity = await prisma.tribalEntity.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      kind: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      outgoing: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          relationshipType: true,
          description: true,
          toEntity: { select: { id: true, name: true, kind: true } },
          claim: { select: { id: true, statement: true, status: true, source: { select: { id: true, title: true } } } }
        }
      },
      incoming: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          relationshipType: true,
          description: true,
          fromEntity: { select: { id: true, name: true, kind: true } },
          claim: { select: { id: true, statement: true, status: true, source: { select: { id: true, title: true } } } }
        }
      },
      claims: {
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          statement: true,
          status: true,
          reviewedByHuman: true,
          reviewedAt: true,
          source: { select: { id: true, title: true } },
          supportingPassages: {
            take: 10,
            select: { id: true, pageLabel: true, locator: true, reviewedByHuman: true, source: { select: { id: true, title: true } } }
          },
          contradictingPassages: {
            take: 10,
            select: { id: true, pageLabel: true, locator: true, reviewedByHuman: true, source: { select: { id: true, title: true } } }
          }
        }
      },
      passages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          pageLabel: true,
          locator: true,
          passageText: true,
          reviewedByHuman: true,
          reviewNote: true,
          source: { select: { id: true, title: true } }
        }
      }
    }
  });

  if (!entity) notFound();

  const [workspaceNote] = await Promise.all([
    prisma.workspaceEntityNote.findUnique({
      where: { workspaceId_entityId: { workspaceId: workspace.workspaceId, entityId: entity.id } },
      select: { note: true }
    })
  ]);
  const canEditNote = roleAtLeast(workspace.role, "EDITOR");
  const relationships = [
    ...entity.outgoing.map(item => ({
      id: item.id,
      direction: "يرتبط بـ",
      related: item.toEntity,
      type: item.relationshipType,
      description: item.description,
      claim: item.claim
    })),
    ...entity.incoming.map(item => ({
      id: item.id,
      direction: "يرتبط به",
      related: item.fromEntity,
      type: item.relationshipType,
      description: item.description,
      claim: item.claim
    }))
  ];

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/entities" className="brand">
          <span className="brand-mark">م</span>
          <span><strong>مجالس العرب</strong><small>ملف الكيان البحثي</small></span>
        </Link>
        <div className="hero-actions">
          <Link href="/entities" className="secondary-button">كل الكيانات</Link>
          <Link href="/sources" className="secondary-button">المصادر</Link>
        </div>
      </header>

      <section className="page-intro">
        <p className="eyebrow">ملف مبني على السجل الفعلي</p>
        <h1>{entity.name}</h1>
        <p className="intro">{entity.summary || "لا يوجد ملخص موثق مسجل لهذا الكيان حتى الآن."}</p>
        <div className="hero-actions">
          <span className="status-label">{kindLabels[entity.kind] ?? "نوع غير محدد"}</span>
          <span className="status-label">{entity.claims.length} ادعاء مسجل</span>
          <span className="status-label">{relationships.length} علاقة مسجلة</span>
        </div>
      </section>

      <section className="unknowns compact-unknowns">
        <strong>حدود هذا الملف</strong>
        <p>هذه صفحة بحثية وليست شهادة نسب. العلاقات والادعاءات تعرض كما سُجلت في قاعدة البيانات، ولا تُعد صحيحة لمجرد ظهورها. افحص نصوص المصادر وحالة المراجعة، ولا نملأ المعلومات الناقصة بالتخمين.</p>
      </section>

      <section className="panel list-panel">
        <div className="list-heading"><h2>العلاقات المسجلة</h2><span className="count-pill">{relationships.length}</span></div>
        {relationships.length === 0 ? (
          <div className="empty-state"><strong>لا توجد علاقات موثقة مسجلة</strong><p>لن نرسم شجرة نسب افتراضية. ستظهر العلاقات بعد تسجيلها وربطها بمصدر قابل للفحص.</p></div>
        ) : (
          <div className="entity-list">
            {relationships.map(relation => (
              <article className="entity-row" key={relation.id}>
                <div>
                  <h3><Link className="text-link" href={`/entities/${relation.related.id}`}>{relation.related.name} ←</Link></h3>
                  <p>{relation.direction} · نوع العلاقة المسجل: {relation.type}</p>
                  {relation.description && <p>{relation.description}</p>}
                  {relation.claim && <p>الادعاء المرتبط: {relation.claim.statement} · الحالة: {claimLabels[relation.claim.status] ?? relation.claim.status}</p>}
                  {relation.claim?.source && <small>المصدر: <Link className="text-link" href={`/sources/${relation.claim.source.id}`}>{relation.claim.source.title}</Link></small>}
                </div>
                <span className="status-label">علاقة مسجلة</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel list-panel">
        <div className="list-heading"><h2>الادعاءات والأدلة المرتبطة</h2><span className="count-pill">{entity.claims.length}</span></div>
        {entity.claims.length === 0 ? (
          <div className="empty-state"><strong>لا توجد ادعاءات مرتبطة بهذا الكيان</strong><p>لا نؤلف تاريخًا أو نسبًا عند غياب السجل والمصدر.</p></div>
        ) : (
          <div className="entity-list">
            {entity.claims.map(claim => (
              <article className="entity-row" key={claim.id}>
                <div>
                  <h3>{claim.statement}</h3>
                  <p>حالة الادعاء: {claimLabels[claim.status] ?? claim.status} · مراجعة بشرية: {claim.reviewedByHuman ? "مسجلة" : "غير مسجلة"}</p>
                  {claim.source && <p>المصدر المباشر: <Link className="text-link" href={`/sources/${claim.source.id}`}>{claim.source.title}</Link></p>}
                  <small>أدلة مؤيدة: {claim.supportingPassages.length} · أدلة مناقضة: {claim.contradictingPassages.length}</small>
                  {[...claim.supportingPassages, ...claim.contradictingPassages].map(passage => (
                    <p key={passage.id}>
                      <Link className="text-link" href={`/sources/${passage.source?.id ?? ""}`}>
                        {passage.source?.title ?? "فتح المصدر"}
                      </Link>
                      {" · "}{passage.pageLabel || passage.locator || "موضع غير محدد"}
                      {" · "}{passage.reviewedByHuman ? "المقطع مراجع بشريًا" : "المقطع غير مراجع"}
                    </p>
                  ))}
                </div>
                <span className={claim.status === "DISPUTED" ? "status-label pending" : "status-label"}>{claimLabels[claim.status] ?? claim.status}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel list-panel">
        <div className="list-heading"><h2>مقاطع المصادر المرتبطة</h2><span className="count-pill">{entity.passages.length}</span></div>
        {entity.passages.length === 0 ? (
          <div className="empty-state"><strong>لا توجد مقاطع مصدر مرتبطة</strong><p>لا يوجد نص مقتبس مرتبط مباشرة بهذا الكيان في قاعدة البيانات حتى الآن.</p></div>
        ) : (
          <div className="entity-list">
            {entity.passages.map(passage => (
              <article className="entity-row" key={passage.id}>
                <div>
                  <h3><Link className="text-link" href={`/sources/${passage.source.id}`}>{passage.source.title} ←</Link></h3>
                  <small>{passage.pageLabel || passage.locator || "موضع غير محدد"} · {passage.reviewedByHuman ? "مراجع بشريًا" : "لم يُراجع بشريًا"}</small>
                  <blockquote>{passage.passageText}</blockquote>
                  {passage.reviewNote && <p>ملاحظة المراجعة: {passage.reviewNote}</p>}
                </div>
                <span className="status-label">{passage.reviewedByHuman ? "مراجع" : "غير مراجع"}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>ملاحظة فريقك</h2>
        <p className="muted">الملاحظات تخص مساحة العمل الحالية فقط ولا تُضاف إلى السجل التاريخي المشترك.</p>
        <EntityWorkspaceNote entityId={entity.id} initialNote={workspaceNote?.note ?? null} canEdit={canEditNote} />
      </section>

      <section className="unknowns compact-unknowns">
        <strong>تغطية السجل</strong>
        <p>تاريخ آخر تحديث مسجل: {entity.updatedAt.toLocaleDateString("ar-SA")} · البيانات المعروضة مقتصرة على السجلات الموجودة في قاعدة البيانات، بحد أقصى 100 علاقة أو ادعاء أو مقطع في كل قسم.</p>
      </section>
    </main>
  );
}
