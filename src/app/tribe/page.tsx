import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";
import TribeKnowledgeEntryForm from "./knowledge-entry-form";

export const dynamic = "force-dynamic";

const kindLabels: Record<string, string> = {
  TRIBE: "قبيلة", CLAN: "فرع", FAMILY: "أسرة", PERSON: "شخص", PLACE: "مكان", OTHER: "كيان"
};
const claimLabels: Record<string, string> = {
  UNREVIEWED: "غير مراجع", UNDER_REVIEW: "قيد المراجعة", SUPPORTED: "مدعوم بعد المراجعة",
  DISPUTED: "متعارض", REJECTED: "مرفوض"
};

export default async function MyTribePage() {
  const workspace = await requireWorkspace();
  const link = await prisma.workspaceTribe.findUnique({
    where: { workspaceId: workspace.workspaceId },
    select: {
      createdAt: true,
      entity: {
        select: {
          id: true, name: true, kind: true, summary: true, updatedAt: true,
          outgoing: {
            orderBy: { createdAt: "asc" }, take: 100,
            select: {
              id: true, relationshipType: true, description: true,
              toEntity: { select: { id: true, name: true, kind: true } },
              claim: { select: { statement: true, status: true, source: { select: { id: true, title: true } } } }
            }
          },
          incoming: {
            orderBy: { createdAt: "asc" }, take: 100,
            select: {
              id: true, relationshipType: true, description: true,
              fromEntity: { select: { id: true, name: true, kind: true } },
              claim: { select: { statement: true, status: true, source: { select: { id: true, title: true } } } }
            }
          },
          claims: {
            orderBy: { updatedAt: "desc" }, take: 50,
            select: {
              id: true, statement: true, status: true, reviewedByHuman: true, reviewedAt: true,
              source: { select: { id: true, title: true } },
              supportingPassages: { take: 5, select: { id: true, pageLabel: true, locator: true, reviewedByHuman: true, source: { select: { id: true, title: true } } } },
              contradictingPassages: { take: 5, select: { id: true, pageLabel: true, locator: true, reviewedByHuman: true, source: { select: { id: true, title: true } } } }
            }
          },
          passages: {
            orderBy: { createdAt: "desc" }, take: 30,
            select: { id: true, pageLabel: true, locator: true, passageText: true, reviewedByHuman: true, source: { select: { id: true, title: true } } }
          },
          knowledgeEntries: {
            orderBy: { createdAt: "desc" }, take: 100,
            select: {
              id: true, content: true, sourceUrl: true, status: true, createdAt: true,
              createdBy: { select: { name: true } }
            }
          },
          places: {
            orderBy: { updatedAt: "desc" }, take: 50,
            select: {
              id: true, name: true, country: true, region: true, description: true, latitude: true, longitude: true,
              source: { select: { id: true, title: true } },
              evidencePassage: { select: { pageLabel: true, locator: true, reviewedByHuman: true } }
            }
          }
        }
      }
    }
  });

  const tribe = link?.entity ?? null;
  const relationships = tribe ? [
    ...tribe.outgoing.map(item => ({
      id: item.id, direction: "يرتبط به من هذا السجل", related: item.toEntity,
      type: item.relationshipType, description: item.description, claim: item.claim
    })),
    ...tribe.incoming.map(item => ({
      id: item.id, direction: "يرتبط بهذا السجل", related: item.fromEntity,
      type: item.relationshipType, description: item.description, claim: item.claim
    }))
  ] : [];

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/council" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>ملف القبيلة المرتبط بمجلسك</small></span></Link>
        <div className="hero-actions"><Link href="/search" className="secondary-button">البحث الموحد</Link><Link href="/setup" className="secondary-button">إعدادات المجلس</Link></div>
      </header>
      {!tribe ? (
        <>
          <section className="page-intro"><p className="eyebrow">ابدأ من سجل موثق</p><h1>ملف قبيلتك</h1><p className="intro">لم يربط مالك هذا المجلس مجلسه بعد بقبيلة أو فرع مسجل في الدليل.</p></section>
          <section className="panel"><div className="empty-state"><strong>لم يتم تحديد قبيلة لهذا المجلس</strong><p>يمكن لمالك المجلس اختيار قبيلة أو فرع من السجلات الموجودة عبر إعدادات المجلس. لن ننشئ اسمًا افتراضيًا أو نفترض انتماء الأعضاء.</p><Link className="primary-button" href="/setup">فتح إعدادات المجلس</Link></div></section>
        </>
      ) : (
        <>
          <section className="page-intro">
            <p className="eyebrow">ملف مستند إلى السجل الفعلي</p>
            <h1>{tribe.name}</h1>
            <p className="intro">{tribe.summary || "لا يوجد ملخص تاريخي موثق مسجل لهذا الكيان حتى الآن."}</p>
            <div className="hero-actions"><span className="status-label">{kindLabels[tribe.kind] ?? tribe.kind}</span><Link className="secondary-button" href={`/entities/${tribe.id}`}>فتح الملف البحثي الكامل ←</Link><Link className="secondary-button" href="/council">دخول المجلس</Link></div>
          </section>
          <section className="unknowns compact-unknowns"><strong>تنبيه مهم</strong><p>هذا هو ملف القبيلة المرتبط بمجلسك، وليس إثباتًا شخصيًا للنسب. كل علاقة أو رواية تظهر كما سُجلت، ويجب فحص مصادرها وحالة مراجعتها قبل اعتبارها حقيقة.</p></section>
          <section className="stats" aria-label="ملخص سجل القبيلة">
            <article><span>العلاقات المسجلة</span><strong>{relationships.length}</strong><small>ليست كلها بالضرورة علاقات نسب</small></article>
            <article><span>الروايات والادعاءات</span><strong>{tribe.claims.length}</strong><small>تشمل الحالات المتعارضة وغير المراجعة</small></article>
            <article><span>مقاطع الأدلة</span><strong>{tribe.passages.length}</strong><small>حتى 30 مقطعًا في هذا الملخص</small></article>
            <article><span>مساهمات الأعضاء</span><strong>{tribe.knowledgeEntries.length}</strong><small>معلومات مشتركة تحتاج إلى مراجعة</small></article>
            <article><span>الأماكن المرتبطة</span><strong>{tribe.places.length}</strong><small>أماكن مرتبطة بكيان هذا الملف</small></article>
          </section>

          <TribeKnowledgeEntryForm tribeName={tribe.name} />

          <section className="panel list-panel">
            <div className="list-heading"><h2>مساهمات أفراد القبيلة</h2><span className="count-pill">{tribe.knowledgeEntries.length}</span></div>
            <p className="muted">تظهر هذه المساهمات للمجالس المرتبطة بسجل القبيلة نفسه. جميع المساهمات تبدأ بحالة غير مراجع ولا تُعد إثباتًا تاريخيًا.</p>
            {tribe.knowledgeEntries.length === 0 ? (
              <div className="empty-state"><strong>لا توجد مساهمات من الأعضاء بعد</strong><p>يمكنك إضافة معلومة مع رابط مصدر إن توفر؛ وستظهر للجميع بحالة مراجعة واضحة.</p></div>
            ) : (
              <div className="entity-list">{tribe.knowledgeEntries.map(entry => (
                <article className="entity-row" key={entry.id}>
                  <div>
                    <p>{entry.content}</p>
                    <small>أضافها: {entry.createdBy?.name || "عضو"} · {entry.createdAt.toLocaleDateString("ar-SA")}</small>
                    {entry.sourceUrl && <p><a className="text-link" href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">فتح المصدر المقدم ↗</a></p>}
                  </div>
                  <span className="status-label pending">غير مراجع</span>
                </article>
              ))}</div>
            )}
          </section>

          <section className="panel list-panel">
            <div className="list-heading"><h2>الأسماء والفروع والعلاقات</h2><span className="count-pill">{relationships.length}</span></div>
            {relationships.length === 0 ? <div className="empty-state"><strong>لا توجد علاقات مسجلة بعد</strong><p>ستظهر هنا الفروع والأشخاص والكيانات الأخرى بعد ربطها من خلال سجل ومصدر قابل للفحص. لن ننشئ شجرة نسب افتراضية.</p></div> :
              <div className="entity-list">{relationships.map(item => <article className="entity-row" key={item.id}>
                <div><h3><Link className="text-link" href={`/entities/${item.related.id}`}>{item.related.name} ←</Link></h3>
                  <p>{kindLabels[item.related.kind] ?? item.related.kind} · {item.direction} · نوع العلاقة المسجل: {item.type}</p>
                  {item.description && <p>{item.description}</p>}
                  {item.claim && <p>الرواية المرتبطة: {item.claim.statement} · {claimLabels[item.claim.status] ?? item.claim.status}</p>}
                  {item.claim?.source && <small>المصدر: <Link className="text-link" href={`/sources/${item.claim.source.id}`}>{item.claim.source.title}</Link></small>}
                </div><span className="status-label">علاقة مسجلة</span>
              </article>)}</div>}
          </section>

          <section className="panel list-panel">
            <div className="list-heading"><h2>الروايات التاريخية والأدلة المتعارضة</h2><span className="count-pill">{tribe.claims.length}</span></div>
            {tribe.claims.length === 0 ? <div className="empty-state"><strong>لا توجد روايات مسجلة لهذا الكيان</strong><p>أضف الروايات بعد استخراجها من مصادر يمكن مراجعتها، مع الحفاظ على الأدلة المؤيدة والمناقضة.</p></div> :
              <div className="entity-list">{tribe.claims.map(claim => <article className="entity-row" key={claim.id}>
                <div><h3>{claim.statement}</h3><p>الحالة: {claimLabels[claim.status] ?? claim.status} · مراجعة بشرية: {claim.reviewedByHuman ? "مسجلة" : "غير مسجلة"}</p>
                  {claim.source && <p>المصدر المباشر: <Link className="text-link" href={`/sources/${claim.source.id}`}>{claim.source.title}</Link></p>}
                  <small>أدلة مؤيدة: {claim.supportingPassages.length} · أدلة مناقضة: {claim.contradictingPassages.length}</small>
                  {[...claim.supportingPassages, ...claim.contradictingPassages].map(p => <p key={p.id}><Link className="text-link" href={`/sources/${p.source.id}`}>{p.source.title}</Link> · {p.pageLabel || p.locator || "موضع غير محدد"} · {p.reviewedByHuman ? "مراجع بشريًا" : "غير مراجع"}</p>)}
                </div><span className={claim.status === "DISPUTED" ? "status-label pending" : "status-label"}>{claimLabels[claim.status] ?? claim.status}</span>
              </article>)}</div>}
          </section>

          <section className="panel list-panel">
            <div className="list-heading"><h2>الأماكن المرتبطة</h2><span className="count-pill">{tribe.places.length}</span></div>
            {tribe.places.length === 0 ? <div className="empty-state"><strong>لا توجد أماكن مرتبطة بعد</strong><p>ستظهر الأماكن عند ربطها بهذا الكيان ومقطع مصدر مراجع.</p><Link className="text-link" href="/places">استعراض سجل الأماكن ←</Link></div> :
              <div className="entity-list">{tribe.places.map(place => <article className="entity-row" key={place.id}>
                <div><h3>{place.name}</h3><p>{[place.country, place.region].filter(Boolean).join(" · ") || "لم تسجل الدولة أو المنطقة"}</p>
                  {place.description && <p>{place.description}</p>}
                  {place.latitude !== null && place.longitude !== null && <small>الإحداثيات المسجلة: {place.latitude}, {place.longitude}</small>}
                  {place.source && <p><Link className="text-link" href={`/sources/${place.source.id}`}>{place.source.title} ←</Link> · {place.evidencePassage?.pageLabel || place.evidencePassage?.locator || "موضع غير محدد"} · {place.evidencePassage?.reviewedByHuman ? "المقطع مراجع" : "المقطع غير مراجع"}</p>}
                </div>
              </article>)}</div>}
          </section>

          <section className="panel list-panel">
            <div className="list-heading"><h2>مقاطع المصادر</h2><span className="count-pill">{tribe.passages.length}</span></div>
            {tribe.passages.length === 0 ? <div className="empty-state"><strong>لا توجد مقاطع مصدر مرتبطة مباشرة</strong><p>لا نملأ تاريخ القبيلة بنصوص غير موجودة في قاعدة البيانات.</p></div> :
              <div className="entity-list">{tribe.passages.map(p => <article className="entity-row" key={p.id}>
                <div><h3><Link className="text-link" href={`/sources/${p.source.id}`}>{p.source.title} ←</Link></h3><small>{p.pageLabel || p.locator || "موضع غير محدد"} · {p.reviewedByHuman ? "مراجع بشريًا" : "غير مراجع"}</small><blockquote>{p.passageText}</blockquote></div>
                <span className={p.reviewedByHuman ? "status-label" : "status-label pending"}>{p.reviewedByHuman ? "مراجع" : "غير مراجع"}</span>
              </article>)}</div>}
          </section>
          <section className="unknowns compact-unknowns"><strong>تغطية السجل</strong><p>آخر تحديث مسجل للكيان: {tribe.updatedAt.toLocaleDateString("ar-SA")} · ارتباط المجلس أُنشئ في: {link?.createdAt.toLocaleDateString("ar-SA")} · تُعرض حدود النتائج الموضحة لكل قسم، ويمكن فتح الملف الكامل للوصول إلى بقية السجلات.</p></section>
        </>
      )}
    </main>
  );
}
