import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_BASE = "https://ar.wikisource.org/w/api.php";
const MAX_TEXT_CHARS = 500_000;
const MAX_PASSAGE_CHARS = 1_800;
const MAX_PASSAGES = 250;

export function parseWikisourcePageUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("أدخل رابط صفحة صحيحًا من ويكي مصدر العربية."); }
  if (url.protocol !== "https:" || url.hostname !== "ar.wikisource.org" || !url.pathname.startsWith("/wiki/") || url.username || url.password) {
    throw new Error("المسموح حاليًا روابط صفحات https://ar.wikisource.org/wiki/ فقط.");
  }
  const title = decodeURIComponent(url.pathname.slice("/wiki/".length)).replace(/_/g, " ").trim();
  if (!title || title.includes("..")) throw new Error("تعذر استخراج عنوان الصفحة من الرابط.");
  return { title, url: `https://ar.wikisource.org/wiki/${encodeURIComponent(title).replace(/%20/g, "_")}` };
}

export function cleanWikiExtract(raw) {
  return String(raw ?? "")
    .replace(/\r/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitPassages(text, maxChars = MAX_PASSAGE_CHARS) {
  const normalized = cleanWikiExtract(text);
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) { chunks.push(current); current = ""; }
      for (let i = 0; i < paragraph.length; i += maxChars) chunks.push(paragraph.slice(i, i + maxChars));
      continue;
    }
    if (!current) current = paragraph;
    else if ((current + "\n\n" + paragraph).length <= maxChars) current += "\n\n" + paragraph;
    else { chunks.push(current); current = paragraph; }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function fetchWikisourcePage(title) {
  const url = new URL(API_BASE);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts|info");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("titles", title);
  const response = await fetch(url, {
    headers: { "User-Agent": "MajalisArabResearch/1.0 (source ingestion; contact project maintainers)" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`تعذر جلب الصفحة من ويكي مصدر (HTTP ${response.status}).`);
  const payload = await response.json();
  if (payload?.error) throw new Error("أعاد ويكي مصدر خطأ أثناء قراءة الصفحة.");
  const page = payload?.query?.pages?.[0];
  if (!page || page.missing || !page.extract) throw new Error("لم يُعثر على نص قابل للاستخراج لهذه الصفحة.");
  const extract = cleanWikiExtract(page.extract);
  if (!extract) throw new Error("الصفحة لا تحتوي نصًا بعد التنظيف.");
  if (extract.length > MAX_TEXT_CHARS) throw new Error(`النص أكبر من الحد الآمن (${MAX_TEXT_CHARS} حرف). استخدم صفحة أو قسمًا أصغر.`);
  return { title: page.title || title, canonicalUrl: page.fullurl, extract };
}

async function main() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf("--url");
  const workspaceIndex = args.indexOf("--workspace-id");
  if (urlIndex < 0 || !args[urlIndex + 1] || workspaceIndex < 0 || !args[workspaceIndex + 1]) {
    process.stderr.write("Usage: npm run db:fetch-wikisource -- --url https://ar.wikisource.org/wiki/PAGE --workspace-id EXISTING_WORKSPACE_ID\n");
    process.exitCode = 2;
    return;
  }
  const workspaceId = args[workspaceIndex + 1];
  const requested = parseWikisourcePageUrl(args[urlIndex + 1]);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) throw new Error("مساحة العمل غير موجودة.");

  const fetched = await fetchWikisourcePage(requested.title);
  const passages = splitPassages(fetched.extract);
  if (!passages.length) throw new Error("لم ينتج النص أي مقاطع قابلة للحفظ.");
  if (passages.length > MAX_PASSAGES) throw new Error(`الصفحة تنتج أكثر من ${MAX_PASSAGES} مقطع؛ ارفضنا الحفظ لتجنب استيراد غير مقصود.`);

  let source = await prisma.source.findFirst({
    where: { url: requested.url },
    select: { id: true, humanReviewed: true }
  });
  let sourceCreated = false;
  if (!source) {
    source = await prisma.source.create({
      data: {
        title: fetched.title,
        publisher: "ويكي مصدر",
        url: requested.url,
        bibliographicNote: "نص صفحة ويب جُلب عبر واجهة MediaWiki API. لا يمثل بالضرورة كتابًا كاملًا أو طبعة مطبوعة محددة؛ يلزم توثيق المؤلف والطبعة والصفحات ومراجعة النص يدويًا.",
        accessStatus: "NOT_CHECKED",
        extractionStatus: "EXTRACTED",
        humanReviewed: false
      },
      select: { id: true, humanReviewed: true }
    });
    sourceCreated = true;
  } else {
    await prisma.source.update({
      where: { id: source.id },
      data: { extractionStatus: "EXTRACTED" }
    });
  }

  let passagesCreated = 0;
  let duplicatesSkipped = 0;
  for (let i = 0; i < passages.length; i++) {
    const passageText = passages[i];
    const pageLabel = `نص صفحة الويب؛ المقطع ${i + 1} من ${passages.length} (ليس رقم صفحة مطبوعة)`;
    const existing = await prisma.evidencePassage.findFirst({
      where: { sourceId: source.id, pageLabel, passageText },
      select: { id: true }
    });
    if (existing) { duplicatesSkipped++; continue; }
    await prisma.evidencePassage.create({
      data: {
        sourceId: source.id,
        pageLabel,
        passageText,
        locator: fetched.canonicalUrl || requested.url,
        extractedAt: new Date(),
        reviewedByHuman: false
      }
    });
    passagesCreated++;
  }

  await prisma.auditLog.create({
    data: {
      workspaceId,
      actor: "wikisource-text-ingestion",
      action: "WIKISOURCE_PAGE_TEXT_IMPORTED",
      targetType: "Source",
      targetId: source.id,
      details: JSON.stringify({
        url: fetched.canonicalUrl || requested.url,
        passageCount: passages.length,
        passagesCreated,
        duplicatesSkipped,
        textCharacters: fetched.extract.length,
        sourceHumanReviewed: source.humanReviewed
      })
    }
  });

  process.stdout.write(JSON.stringify({
    title: fetched.title,
    url: fetched.canonicalUrl || requested.url,
    sourceCreated,
    textCharacters: fetched.extract.length,
    passagesFound: passages.length,
    passagesCreated,
    duplicatesSkipped,
    humanReviewRequired: true,
    warning: "تم جلب نص صفحة ويب فقط. لم تُثبت بيانات الطبعة أو أرقام الصفحات المطبوعة أو صحة أي نسب؛ لم تُنشأ قبائل أو ادعاءات تاريخية."
  }, null, 2) + "\n");
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(error => {
    process.stderr.write((error instanceof Error ? error.message : "فشل جلب النص") + "\n");
    process.exitCode = 1;
  }).finally(async () => prisma.$disconnect());
}
