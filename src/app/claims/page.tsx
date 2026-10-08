import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  UNREVIEWED: "غير مراجع",
  UNDER_REVIEW: "قيد المراجعة",
  SUPPORTED: "تدعمه الأدلة بعد المراجعة",
  DISPUTED: "متعارض",
  REJECTED: "مرفوض"
};

export default async function ClaimsPage() {
  await requireWorkspace();
  const claims = await prisma.historicalClaim.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      statement: true,
      status: true,
      reviewedByHuman: true,
      reviewedAt: true,
      entity: { select: { name: true } },
      supportingPassages: { select: { id: true, reviewedByHuman: true } },
      contradictingPassages: { select: { id: true, reviewedByHuman: true } },
      source: { select: { title: true } }
    }
  });
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>سجل الادعاءات</small></span></Link>
        <Link href="/" className="secondary-button">الرئيسية</Link>
      </header>
      <section className="page-intro"><p className="eyebrow">المراجعة والتعارض</p><h1>الادعاءات التاريخية</h1><p className="intro">نعرض حالة كل ادعاء والأدلة المؤيدة والمناقضة. وجود ادعاء في النظام لا يجعله حقيقة مثبتة.</p></section>
      <section className="panel list-panel">
        <div className="list-heading"><h2>الادعاءات المسجلة</h2><span className="count-pill">{claims.length}</span></div>
        {claims.length === 0 ? <div className="empty-state"><strong>لا توجد ادعاءات مسجلة بعد</strong><p>لن تُنشأ ادعاءات تلقائيًا. كل ادعاء مستقبلي يجب أن يرتبط بمصدر ومقاطع دليل ومراجعة واضحة.</p></div> :
          <div className="entity-list">{claims.map(claim => {
            const supportingReviewed = claim.supportingPassages.filter(p => p.reviewedByHuman).length;
            const contradictingReviewed = claim.contradictingPassages.filter(p => p.reviewedByHuman).length;
            const canLabelSupported = claim.status === "SUPPORTED" && claim.reviewedByHuman && claim.reviewedAt && claim.supportingPassages.length > 0 && supportingReviewed > 0;
            return <article className="entity-row" key={claim.id}>
              <div><h3>{claim.statement}</h3><p>{claim.entity?.name ? `الكيان: ${claim.entity.name}` : "لم يُربط بكيان"}{claim.source ? ` · المصدر: ${claim.source.title}` : " · لا يوجد مصدر مباشر مرتبط"}</p>
                <small>أدلة مؤيدة: {claim.supportingPassages.length} (مراجع بشريًا: {supportingReviewed}) · أدلة مناقضة: {claim.contradictingPassages.length} (مراجع بشريًا: {contradictingReviewed})</small>
                {!canLabelSupported && claim.status === "SUPPORTED" && <p className="warning-note">تنبيه: حالة الدعم تحتاج مراجعة السجل والأدلة قبل اعتمادها في العرض العام.</p>}
              </div><span className={claim.status === "DISPUTED" ? "status-label pending" : "status-label"}>{labels[claim.status] ?? claim.status}</span>
            </article>;
          })}</div>}
      </section>
      <section className="unknowns compact-unknowns"><strong>ما لا نعرفه بعد</strong><p>لم تُبنَ بعد واجهة إنشاء الادعاءات أو سير اعتماد المراجعين. هذه الصفحة للقراءة من قاعدة البيانات فقط في هذه المرحلة.</p></section>
    </main>
  );
}