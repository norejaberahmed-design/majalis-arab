import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";
import { roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";
import PlaceCreateForm from "./place-create-form";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const workspace = await requireWorkspace();
  const canManagePlaces = roleAtLeast(workspace.role, "REVIEWER") &&
    isCatalogueCurator(workspace.user.email, process.env.CATALOGUE_CURATOR_EMAILS);

  const [places, passages, entities] = await Promise.all([
    prisma.place.findMany({
      orderBy: { updatedAt: "desc" }, take: 200,
      select: {
        id: true, name: true, country: true, region: true, description: true,
        latitude: true, longitude: true, sourceNote: true,
        source: { select: { id: true, title: true } },
        entity: { select: { id: true, name: true } },
        evidencePassage: { select: { id: true, pageLabel: true, locator: true, reviewedByHuman: true } }
      }
    }),
    canManagePlaces ? prisma.evidencePassage.findMany({
      where: { reviewedByHuman: true, source: { is: { humanReviewed: true, accessStatus: { not: "NOT_CHECKED" } } } },
      orderBy: [{ sourceId: "asc" }, { pageLabel: "asc" }], take: 500,
      select: { id: true, pageLabel: true, locator: true, passageText: true, source: { select: { id: true, title: true } } }
    }) : Promise.resolve([]),
    canManagePlaces ? prisma.tribalEntity.findMany({ orderBy: { name: "asc" }, take: 500, select: { id: true, name: true, kind: true } }) : Promise.resolve([])
  ]);

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/research" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>سجل الأماكن</small></span></Link>
        <div className="hero-actions"><Link href="/entities" className="secondary-button">الكيانات</Link><Link href="/sources" className="secondary-button">المصادر</Link></div>
      </header>
      <section className="page-intro">
        <p className="eyebrow">الجغرافيا مع الدليل</p>
        <h1>الأماكن التاريخية</h1>
        <p className="intro">سجل للأماكن والمناطق المرتبطة بالمصادر. لا نعرض إحداثيات غير مسجلة، وكل مكان جديد يجب أن يرتبط بمقطع نصي مراجع يمكن فتح مصدره.</p>
      </section>
      <section className="panel list-panel">
        <div className="list-heading"><h2>الأماكن المسجلة</h2><span className="count-pill">{places.length}</span></div>
        {places.length === 0 ? <div className="empty-state"><strong>لا توجد أماكن مسجلة بعد</strong><p>لن نضيف مواقع أو إحداثيات تخمينية. ابدأ من مصدر تاريخي ومقطع مراجع.</p></div> :
          <div className="entity-list">{places.map(place => (
            <article className="entity-row" key={place.id}>
              <div><h3>{place.name}</h3><p>{[place.country, place.region].filter(Boolean).join(" · ") || "لم تُسجل الدولة أو المنطقة"}</p>
                {place.description && <p>{place.description}</p>}
                {place.entity && <p>الكيان المرتبط: <Link className="text-link" href={"/entities/" + place.entity.id}>{place.entity.name} ←</Link></p>}
                {place.latitude !== null && place.longitude !== null && <small>الإحداثيات المسجلة: {place.latitude}, {place.longitude}</small>}
                {place.source && <p><Link className="text-link" href={"/sources/" + place.source.id}>{place.source.title} ←</Link> · {place.evidencePassage?.pageLabel || place.evidencePassage?.locator || "موضع غير محدد"}</p>}
                {!place.source && place.sourceNote && <small>{place.sourceNote}</small>}
              </div>
              <span className="status-label">{place.evidencePassage?.reviewedByHuman ? "مرتبط بمقطع مراجع" : "لا يوجد مقطع مراجع مرتبط"}</span>
            </article>
          ))}</div>}
      </section>
      {canManagePlaces && <PlaceCreateForm passages={passages} entities={entities} />}
      <section className="unknowns compact-unknowns"><strong>حدود السجل</strong><p>وجود اسم المكان في نص لا يثبت وحده إحداثياته أو حدوده الحديثة. تُحفظ الإحداثيات فقط إذا أدخلها الباحث من مرجع مستقل، وتبقى قابلة للمراجعة.</p></section>
    </main>
  );
}
