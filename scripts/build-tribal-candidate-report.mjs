import { PrismaClient } from "@prisma/client";
import { extractNameCandidates, normalizeArabicName } from "./extract-tribal-name-candidates.mjs";

const prisma = new PrismaClient();

export function buildCrossSourceReport(passages) {
  const groups = new Map();

  for (const passage of passages) {
    const candidates = extractNameCandidates(passage.passageText ?? "");
    for (const candidate of candidates) {
      const normalizedName = normalizeArabicName(candidate.name);
      if (!normalizedName) continue;

      let group = groups.get(normalizedName);
      if (!group) {
        group = {
          normalizedName,
          nameVariants: [],
          distinctSourceCount: 0,
          passageCount: 0,
          evidence: [],
          reviewStatus: "UNREVIEWED",
          interpretationWarning: "الاشتراك في الاسم أو تطابقه إملائيًا لا يثبت أن الشواهد تتحدث عن القبيلة أو الكيان نفسه."
        };
        groups.set(normalizedName, group);
      }

      if (!group.nameVariants.includes(candidate.name)) group.nameVariants.push(candidate.name);
      group.passageCount += 1;
      group.evidence.push({
        sourceId: passage.sourceId,
        sourceTitle: passage.source?.title ?? null,
        sourceUrl: passage.source?.url ?? null,
        sourceAuthor: passage.source?.author ?? null,
        sourceEdition: passage.source?.edition ?? null,
        passageId: passage.id,
        pageLabel: passage.pageLabel ?? null,
        locator: passage.locator ?? null,
        quote: candidate.quote,
        passageReviewedByHuman: passage.reviewedByHuman === true,
        sourceHumanReviewed: passage.source?.humanReviewed === true
      });
    }
  }

  for (const group of groups.values()) {
    group.distinctSourceCount = new Set(group.evidence.map(item => item.sourceId)).size;
    group.evidence.sort((a, b) =>
      String(a.sourceTitle ?? "").localeCompare(String(b.sourceTitle ?? ""), "ar") ||
      String(a.pageLabel ?? "").localeCompare(String(b.pageLabel ?? ""), "ar")
    );
  }

  return [...groups.values()].sort((a, b) =>
    b.distinctSourceCount - a.distinctSourceCount ||
    b.passageCount - a.passageCount ||
    a.normalizedName.localeCompare(b.normalizedName, "ar")
  );
}

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 10000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100000) {
    process.stderr.write("--limit must be an integer from 1 to 100000.\n");
    process.exitCode = 2;
    return;
  }

  const passages = await prisma.evidencePassage.findMany({
    orderBy: [{ sourceId: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      sourceId: true,
      pageLabel: true,
      locator: true,
      passageText: true,
      reviewedByHuman: true,
      source: { select: { title: true, url: true, author: true, edition: true, humanReviewed: true } }
    }
  });

  const candidates = buildCrossSourceReport(passages);
  process.stdout.write(JSON.stringify({
    generatedAt: new Date().toISOString(),
    passagesScanned: passages.length,
    candidateGroups: candidates.length,
    distinctSourcesWithCandidates: new Set(candidates.flatMap(group => group.evidence.map(item => item.sourceId))).size,
    candidates,
    limitations: [
      "النتائج مرشحات نصية للمراجعة وليست إثباتًا للهوية القبلية أو النسب.",
      "عدد المصادر يحسب بمعرف المصدر الفريد، لا بعدد المقاطع.",
      "تطابق الاسم الموحّد لأغراض المقارنة الإملائية فقط ولا يدمج الكيانات تاريخيًا.",
      "لم تُنشأ كيانات قبلية أو علاقات أو دعاوى تاريخية، ولم تُعدّل حالة مراجعة أي مصدر أو مقطع."
    ]
  }, null, 2) + "\n");
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(error => {
    process.stderr.write((error instanceof Error ? error.message : "Cross-source candidate report failed") + "\n");
    process.exitCode = 1;
  }).finally(async () => prisma.$disconnect());
}
