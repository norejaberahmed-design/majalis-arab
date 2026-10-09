import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";
import ReviewDraftActions from "./review-draft-actions";

export const dynamic = "force-dynamic";

export default async function CurationPage() {
  const context = await getWorkspaceContext(await headers());
  if (!context || !roleAtLeast(context.role, "REVIEWER") ||
      !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
    notFound();
  }

  const drafts = await prisma.researchSuggestion.findMany({
    where: { workspaceId: context.workspaceId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      statement: true,
      evidenceQuote: true,
      createdAt: true,
      source: { select: { id: true, title: true, author: true } },
      passage: { select: { id: true, pageLabel: true, locator: true, passageText: true, entity: { select: { id: true, name: true } } } }
    }
  });

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/research" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>مراجعة الأدلة</small></span></Link>
        <Link href="/sources" className="secondary-button">المصادر</Link>
      </header>
      <section className="page-intro">
        <p className="eyebrow">مراجعة بشرية قبل الاعتماد</p>
        <h1>مسودات الادعاءات</h1>
        <p className="intro">هذه اقتراحات مستخرجة من مقاطع المصادر. لا تصبح حقيقة معتمدة بمجرد ظهورها هنا؛ راجع نص المصدر وسياقه، ثم اقبل المسودة كسجل ادعاء غير مراجع أو ارفضها.</p>
      </section>
      <section className="panel list-panel">
        <div className="list-heading"><h2>بانتظار المراجعة</h2><span className="count-pill">{drafts.length}</span></div>
        {drafts.length === 0 ? (
          <div className="empty-state"><strong>لا توجد مسودات معلّقة</strong><p>ستظهر المسودات هنا عندما تتوفر خدمة الاستخراج الخلفية ويُسجل مقطع مصدر جديد. لا تتم إضافة ادعاءات تلقائيًا إلى الكتالوج.</p></div>
        ) : <div className="entity-list">
          {drafts.map(draft => (
            <article className="entity-row" key={draft.id}>
              <div className="draft-review-body">
                <h3>{draft.statement}</h3>
                <p><strong>المصدر:</strong> <Link className="text-link" href={`/sources/${draft.source.id}`}>{draft.source.title}</Link>{draft.source.author ? ` · ${draft.source.author}` : ""}</p>
                <p><strong>الموضع:</strong> {draft.passage.pageLabel || "لم يحدد"}{draft.passage.locator ? ` · ${draft.passage.locator}` : ""}</p>
                {draft.passage.entity && <p><strong>الكيان المرتبط:</strong> <Link className="text-link" href={`/entities/${draft.passage.entity.id}`}>{draft.passage.entity.name}</Link></p>}
                <blockquote><strong>الاقتباس الداعم المقترح</strong><p>{draft.evidenceQuote}</p></blockquote>
                <details><summary>عرض نص المقطع كاملًا</summary><blockquote>{draft.passage.passageText}</blockquote></details>
                <small>تاريخ الإنشاء: {draft.createdAt.toLocaleDateString("ar-SA")}</small>
                <ReviewDraftActions draftId={draft.id} />
              </div>
              <span className="status-label pending">بانتظار المراجعة</span>
            </article>
          ))}
        </div>}
      </section>
    </main>
  );
}
