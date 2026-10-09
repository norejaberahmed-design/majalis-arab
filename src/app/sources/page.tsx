import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { safeExternalHttpUrl } from "@/lib/safe-url";
import { requireWorkspace } from "@/lib/current-user";
import SourceIntakeForm from "./source-intake-form";
import { roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";

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

export default async function SourcesPage() {
  const workspace = await requireWorkspace();
  const canRegisterSource = roleAtLeast(workspace.role, "REVIEWER") &&
    isCatalogueCurator(workspace.user.email, process.env.CATALOGUE_CURATOR_EMAILS);
  const sources = await prisma.source.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      author: true,
      publisher: true,
      publicationYear: true,
      url: true,
      accessStatus: true,
      extractionStatus: true,
      humanReviewed: true,
      updatedAt: true,
      _count: { select: { passages: true, claims: true } }
    }
  });
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>سجل المصادر</small></span></Link>
        <Link href="/" className="secondary-button">الرئيسية</Link>
</header>
      <section className="page-intro"><p className="eyebrow">المراجع أولًا</p><h1>المصادر والأدلة</h1><p className="intro">هذا كتالوج بحثي مشترك للقراءة عبر مساحات العمل. نفصل بين وجود المرجع، وإمكانية الوصول إليه، واستخراج نصه، ومراجعته بشريًا.</p></section>
      <section className="panel list-panel">
        <div className="list-heading"><h2>سجل المصادر</h2><span className="count-pill">{sources.length}</span></div>
        {sources.length === 0 ? <div className="empty-state"><strong>لا توجد مصادر مسجلة بعد</strong><p>لم نضف مراجع افتراضية. يجب تسجيل بيانات المرجع والتحقق من الإتاحة قبل استخدامه دليلًا.</p></div> :
          <div className="entity-list">{sources.map(source => <article className="entity-row" key={source.id}>
            <div><h3>{source.title}</h3><p>{[source.author, source.publisher, source.publicationYear].filter(Boolean).join(" · ") || "بيانات ببليوغرافية غير مكتملة"}</p>
              {safeExternalHttpUrl(source.url) && <a className="text-link" href={safeExternalHttpUrl(source.url)!} target="_blank" rel="noopener noreferrer">فتح رابط المصدر ↗</a>}
              <small>{accessLabels[source.accessStatus]} · {extractionLabels[source.extractionStatus]} · {source._count.passages} مقطع دليل · {source._count.claims} ادعاء</small>
            </div><span className={source.humanReviewed ? "status-label" : "status-label pending"}>{source.humanReviewed ? "مراجع بشريًا" : "لم يراجع بشريًا"}</span>
          </article>)}</div>}
      </section>
      {canRegisterSource && <SourceIntakeForm />}
      <section className="unknowns compact-unknowns"><strong>ما لا نعرفه بعد</strong><p>لا يوجد حتى الآن استيراد آلي للمصادر أو OCR. حالة الإتاحة والاستخراج لا تُستنتج من رابط وحده.</p></section>
    </main>
  );
}