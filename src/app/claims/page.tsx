import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";
import ClaimCreateForm from "./claim-create-form";
import ClaimReviewActions from "./claim-review-actions";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  UNREVIEWED: "غير مراجع",
  UNDER_REVIEW: "قيد المراجعة",
  SUPPORTED: "تدعمه الأدلة بعد المراجعة",
  DISPUTED: "متعارض",
  REJECTED: "مرفوض"
};

export default async function ClaimsPage() {
  const context = await getWorkspaceContext(await headers());
  if (!context) {
    return <main className="shell"><section className="panel"><h1>سجّل الدخول لعرض سجل الادعاءات</h1><Link className="text-link" href="/login">تسجيل الدخول ←</Link></section></main>;
  }
  const canCreateClaims = roleAtLeast(context.role, "REVIEWER") &&
    isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS);

  const [claims, sources, entities, passages] = await Promise.all([
    prisma.historicalClaim.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true, statement: true, status: true, reviewedByHuman: true, reviewedAt: true,
        entity: { select: { name: true } },
        supportingPassages: { select: { id: true, reviewedByHuman: true } },
        contradictingPassages: { select: { id: true, reviewedByHuman: true } },
        source: { select: { title: true } }
      }
    }),
    canCreateClaims ? prisma.source.findMany({
      where: { humanReviewed: true, accessStatus: { not: "NOT_CHECKED" } },
      orderBy: { title: "asc" }, take: 200,
      select: { id: true, title: true }
    }) : Promise.resolve([]),
    canCreateClaims ? prisma.tribalEntity.findMany({
      orderBy: { name: "asc" }, take: 500, select: { id: true, name: true }
    }) : Promise.resolve([]),
    canCreateClaims ? prisma.evidencePassage.findMany({
      where: { reviewedByHuman: true, source: { is: { humanReviewed: true, accessStatus: { not: "NOT_CHECKED" } } } },
      orderBy: [{ sourceId: "asc" }, { pageLabel: "asc" }], take: 500,
      select: { id: true, sourceId: true, pageLabel: true, locator: true, passageText: true }
    }) : Promise.resolve([])
  ]);

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>سجل الادعاءات</small></span></Link>
        <Link href="/" className="secondary-button">الرئيسية</Link>
      </header>
      <section className="page-intro"><p className="eyebrow">المراجعة والتعارض</p><h1>الادعاءات التاريخية</h1><p className="intro">كل ادعاء مرتبط بمصدر ومقاطع دليل. نعرض الأدلة المؤيدة والمناقضة معًا؛ ووجود الادعاء لا يجعله حقيقة مثبتة.</p></section>
      {canCreateClaims && <ClaimCreateForm sources={sources} entities={entities} passages={passages} />}
      <section className="panel list-panel">
        <div className="list-heading"><h2>الادعاءات المسجلة</h2><span className="count-pill">{claims.length}</span></div>
        {claims.length === 0 ? <div className="empty-state"><strong>لا توجد ادعاءات مسجلة بعد</strong><p>أنشئ ادعاءً من مقطع مراجع بشريًا، أو سجّل المصادر والأدلة أولًا.</p></div> :
          <div className="entity-list">{claims.map(claim => {
            const supportingReviewed = claim.supportingPassages.filter(p => p.reviewedByHuman).length;
            const contradictingReviewed = claim.contradictingPassages.filter(p => p.reviewedByHuman).length;
            const canLabelSupported = claim.status === "SUPPORTED" && claim.reviewedByHuman && claim.reviewedAt && claim.supportingPassages.length > 0 && supportingReviewed > 0;
            return <article className="entity-row" key={claim.id}>
              <div><h3>{claim.statement}</h3><p>{claim.entity?.name ? "الكيان: " + claim.entity.name : "لم يُربط بكيان"}{claim.source ? " · المصدر: " + claim.source.title : " · لا يوجد مصدر مباشر مرتبط"}</p>
                <small>أدلة مؤيدة: {claim.supportingPassages.length} (مراجع بشريًا: {supportingReviewed}) · أدلة مناقضة: {claim.contradictingPassages.length} (مراجع بشريًا: {contradictingReviewed})</small>
                {canCreateClaims && <ClaimReviewActions claimId={claim.id} currentStatus={claim.status} />}
                {!canLabelSupported && claim.status === "SUPPORTED" && <p className="warning-note">تنبيه: حالة الدعم تحتاج مراجعة السجل والأدلة قبل اعتمادها في العرض العام.</p>}
              </div><span className={claim.status === "DISPUTED" ? "status-label pending" : "status-label"}>{labels[claim.status] ?? claim.status}</span>
            </article>;
          })}</div>}
      </section>
      <section className="unknowns compact-unknowns"><strong>حدود الاستنتاج</strong><p>الادعاءات الجديدة تحفظ بحالة «غير مراجع». لا يغيّر ربط الأدلة حالة الادعاء تلقائيًا، ويظل التعارض ظاهرًا بدل إخفائه.</p></section>
    </main>
  );
}
