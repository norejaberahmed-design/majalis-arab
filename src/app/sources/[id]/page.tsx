import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safeExternalHttpUrl } from "@/lib/safe-url";
import { requireWorkspace } from "@/lib/current-user";
import { roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";
import EvidencePassageForm from "../evidence-passage-form";
import SourceReviewActions from "@/app/curation/source-review-actions";
import PassageReviewActions from "@/app/curation/passage-review-actions";
import EntityFromPassageForm from "@/app/curation/entity-from-passage-form";

export const dynamic = "force-dynamic";

const accessLabels: Record<string, string> = {
  NOT_CHECKED: "لم يُتحقق من الإتاحة",
  OPEN_ACCESS: "إتاحة مفتوحة",
  RESTRICTED: "مقيّد",
  UNAVAILABLE: "غير متاح"
};

const extractionLabels: Record<string, string> = {
  NOT_ATTEMPTED: "لم يُستخرج النص",
  EXTRACTED: "تم استخراج النص",
  OCR_REQUIRED: "يتطلب OCR",
  FAILED: "فشل الاستخراج"
};

const claimLabels: Record<string, string> = {
  UNREVIEWED: "غير مراجع",
  UNDER_REVIEW: "قيد المراجعة",
  SUPPORTED: "يدعمه دليل بعد المراجعة",
  DISPUTED: "متعارض",
  REJECTED: "مرفوض"
};

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await requireWorkspace();
  const { id } = await params;
  if (!id || id.length > 64) notFound();

  const source = await prisma.source.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      author: true,
      publisher: true,
      publicationYear: true,
      edition: true,
      url: true,
      bibliographicNote: true,
      accessStatus: true,
      accessCheckedAt: true,
      extractionStatus: true,
      humanReviewed: true,
      updatedAt: true,
      passages: {
        orderBy: [{ pageLabel: "asc" }, { createdAt: "asc" }],
        take: 200,
        select: {
          id: true,
          pageLabel: true,
          passageText: true,
          locator: true,
          reviewedByHuman: true,
          reviewNote: true,
          entity: { select: { id: true, name: true } },
          claims: { select: { id: true, statement: true, status: true } },
          contradicts: { select: { id: true, statement: true, status: true } }
        }
      },
      claims: {
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: { id: true, statement: true, status: true, reviewedByHuman: true, reviewedAt: true }
      }
    }
  });

  if (!source) notFound();
  const safeUrl = safeExternalHttpUrl(source.url);
  const canManageEvidence = !!workspace && roleAtLeast(workspace.role, "REVIEWER") &&
    isCatalogueCurator(workspace.user.email, process.env.CATALOGUE_CURATOR_EMAILS);

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/research" className="brand">
          <span className="brand-mark">م</span>
          <span><strong>مجالس العرب</strong><small>بطاقة المصدر</small></span>
        </Link>
        <div className="hero-actions"><Link href="/sources" className="secondary-button">العودة إلى المصادر</Link>{canManageEvidence && <Link href="/curation" className="secondary-button">مسودات المراجعة</Link>}</div>
      </header>

      <section className="page-intro">
        <p className="eyebrow">سجل ببليوغرافي موثق</p>
        <h1>{source.title}</h1>
        <p className="intro">{[source.author, source.publisher, source.edition, source.publicationYear].filter(Boolean).join(" · ") || "بيانات المؤلف والناشر وسنة النشر غير مكتملة."}</p>
        {safeUrl && <p><a className="text-link" href={safeUrl} target="_blank" rel="noopener noreferrer">فتح موقع المصدر ↗</a></p>}
      </section>

      <section className="stats" aria-label="حالة المصدر">
        <article><span>الإتاحة</span><strong>{accessLabels[source.accessStatus] ?? source.accessStatus}</strong><small>{source.accessCheckedAt ? `آخر تحقق: ${source.accessCheckedAt.toLocaleDateString("ar-SA")}` : "لم يُسجل تاريخ تحقق"}</small></article>
        <article><span>استخراج النص</span><strong>{extractionLabels[source.extractionStatus] ?? source.extractionStatus}</strong><small>وجود رابط لا يثبت قراءة الكتاب</small></article>
        <article><span>المراجعة البشرية</span><strong>{source.humanReviewed ? "تمت المراجعة" : "لم تتم المراجعة"}</strong><small>حالة محفوظة في قاعدة البيانات</small></article>
        <article><span>مقاطع الدليل</span><strong>{source.passages.length}</strong><small>حتى 200 مقطع في هذه الصفحة</small></article>
      </section>

      {source.bibliographicNote && <section className="panel"><h2>ملاحظات ببليوغرافية</h2><p>{source.bibliographicNote}</p></section>}

      <section className="panel list-panel">
        <div className="list-heading"><h2>مقاطع الدليل</h2><span className="count-pill">{source.passages.length}</span></div>
        {source.passages.length === 0 ? (
          <div className="empty-state"><strong>لا توجد مقاطع موثقة لهذا المصدر</strong><p>لن نختلق نصًا أو رقم صفحة. يجب تسجيل المقطع من نسخة أمكن الاطلاع عليها مع محدد صفحة أو موضع قابل للتحقق.</p></div>
        ) : (
          <div className="entity-list">
            {source.passages.map((passage, index) => (
              <article className="entity-row" key={passage.id}>
                <div>
                  <h3>المقطع {index + 1} · {passage.pageLabel ? `الصفحة/الموضع: ${passage.pageLabel}` : "لم يُحدد رقم الصفحة"}</h3>
                  <blockquote>{passage.passageText}</blockquote>
                  {passage.locator && <p><small>محدد إضافي: {passage.locator}</small></p>}
                  {passage.entity && <p><small>الكيان المرتبط: <Link className="text-link" href={`/entities/${passage.entity.id}`}>{passage.entity.name}</Link></small></p>}
                  {passage.claims.length > 0 && <p><small>ادعاءات مؤيدة مرتبطة: {passage.claims.map(c => c.statement).join("؛ ")}</small></p>}
                  {passage.contradicts.length > 0 && <p><small>ادعاءات يناقضها هذا المقطع: {passage.contradicts.map(c => c.statement).join("؛ ")}</small></p>}
                  {passage.reviewNote && <p><small>ملاحظة المراجعة: {passage.reviewNote}</small></p>}
                  {canManageEvidence && !passage.reviewedByHuman && <PassageReviewActions passageId={passage.id} />}
                  {canManageEvidence && passage.reviewedByHuman && source.humanReviewed && !passage.entity && <EntityFromPassageForm passageId={passage.id} />}
                </div>
                <span className={passage.reviewedByHuman ? "status-label" : "status-label pending"}>{passage.reviewedByHuman ? "راجع المقطع بشريًا" : "لم يراجع المقطع بشريًا"}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel list-panel">
        <div className="list-heading"><h2>الادعاءات المرتبطة بالمصدر</h2><span className="count-pill">{source.claims.length}</span></div>
        {source.claims.length === 0 ? <p>لا توجد ادعاءات مرتبطة بهذا المصدر.</p> : <div className="entity-list">
          {source.claims.map(claim => (
            <article className="entity-row" key={claim.id}>
              <div><h3>{claim.statement}</h3><small>{claim.reviewedByHuman && claim.reviewedAt ? "مراجعة بشرية مسجلة" : "لم تكتمل المراجعة البشرية"}</small></div>
              <span className={claim.status === "DISPUTED" ? "status-label pending" : "status-label"}>{claimLabels[claim.status] ?? claim.status}</span>
            </article>
          ))}
        </div>}
      </section>

      {canManageEvidence && <SourceReviewActions sourceId={source.id} accessStatus={source.accessStatus as "NOT_CHECKED" | "OPEN_ACCESS" | "RESTRICTED" | "UNAVAILABLE"} extractionStatus={source.extractionStatus as "NOT_ATTEMPTED" | "EXTRACTED" | "OCR_REQUIRED" | "FAILED"} humanReviewed={source.humanReviewed} />}
      {canManageEvidence && <EvidencePassageForm sourceId={source.id} />}

      <section className="unknowns compact-unknowns">
        <strong>حدود ما نعرفه</strong>
        <p>هذه الصفحة تعرض ما هو مسجل فقط. لا تثبت حالة المراجعة وحدها صحة الرواية، ولا يعني غياب مقطع أن المصدر لا يتناول الموضوع.</p>
      </section>
    </main>
  );
}
