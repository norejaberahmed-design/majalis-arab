import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { safeExternalHttpUrl } from "@/lib/safe-url";
import { requireWorkspace } from "@/lib/current-user";
import SourceIntakeForm from "./source-intake-form";
import SourceCsvImportForm from "./source-csv-import-form";
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

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; status?: string | string[] }> }) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery?.trim().slice(0, 100) ?? "";
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const allowedStatuses = ["NOT_CHECKED", "OPEN_ACCESS", "RESTRICTED", "UNAVAILABLE"];
  const status = rawStatus && allowedStatuses.includes(rawStatus) ? rawStatus : "";
  const workspace = await requireWorkspace();
  const canRegisterSource = !!workspace && roleAtLeast(workspace.role, "REVIEWER") &&
    isCatalogueCurator(workspace.user.email, process.env.CATALOGUE_CURATOR_EMAILS);
  const sources = await prisma.source.findMany({
    where: {
      ...(query ? { OR: [
        { title: { contains: query } },
        { author: { contains: query } },
        { publisher: { contains: query } }
      ] } : {}),
      ...(status ? { accessStatus: status } : {})
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      author: true,
      publisher: true,
      publicationYear: true,
      edition: true,
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
      <section className="entity-form source-search">
        <h2>البحث والتصفية</h2>
        <form method="get" action="/sources">
          <label htmlFor="source-query">عنوان المرجع أو المؤلف أو الناشر</label>
          <input id="source-query" name="q" type="search" maxLength={100} defaultValue={query} placeholder="ابحث في بيانات الفهرسة" />
          <label htmlFor="source-status">حالة الإتاحة</label>
          <select id="source-status" name="status" defaultValue={status}>
            <option value="">كل الحالات</option>
            <option value="NOT_CHECKED">لم يُتحقق من الإتاحة</option>
            <option value="OPEN_ACCESS">إتاحة مفتوحة</option>
            <option value="RESTRICTED">مقيّد</option>
            <option value="UNAVAILABLE">غير متاح</option>
          </select>
          <div className="hero-actions"><button className="primary-button" type="submit">تطبيق البحث</button><Link className="secondary-button" href="/sources">مسح التصفية</Link></div>
        </form>
      </section>
      <section className="panel list-panel">
        <div className="list-heading"><h2>{query || status ? "نتائج البحث" : "سجل المصادر"}</h2><span className="count-pill">{sources.length}</span></div>
        {sources.length === 0 ? <div className="empty-state"><strong>{query || status ? "لا توجد مصادر مطابقة" : "لا توجد مصادر مسجلة بعد"}</strong><p>{query || status ? "جرّب عبارة بحث أخرى أو امسح التصفية." : "لم نضف مراجع افتراضية. يجب تسجيل بيانات المرجع والتحقق من الإتاحة قبل استخدامه دليلًا."}</p></div> :
          <div className="entity-list">{sources.map(source => <article className="entity-row" key={source.id}>
            <div><h3><Link href={`/sources/${source.id}`} className="text-link">{source.title} ←</Link></h3><p>{[source.author, source.publisher, source.edition, source.publicationYear].filter(Boolean).join(" · ") || "بيانات ببليوغرافية غير مكتملة"}</p>
              {safeExternalHttpUrl(source.url) && <a className="text-link" href={safeExternalHttpUrl(source.url)!} target="_blank" rel="noopener noreferrer">فتح رابط المصدر ↗</a>}
              <small>{accessLabels[source.accessStatus]} · {extractionLabels[source.extractionStatus]} · {source._count.passages} مقطع دليل · {source._count.claims} ادعاء</small>
            </div><span className={source.humanReviewed ? "status-label" : "status-label pending"}>{source.humanReviewed ? "مراجع بشريًا" : "لم يراجع بشريًا"}</span>
          </article>)}</div>}
      </section>
      {canRegisterSource && <SourceCsvImportForm />}
      {canRegisterSource && <SourceIntakeForm />}
      <section className="unknowns compact-unknowns"><strong>ما لا نعرفه بعد</strong><p>يمكن استيراد بيانات الفهرسة من CSV. لا يوجد استخراج نص أو OCR آلي هنا، وحالة الإتاحة والاستخراج لا تُستنتج من رابط وحده.</p></section>
    </main>
  );
}