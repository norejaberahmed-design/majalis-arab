import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function buildResearchCorpusAudit({ sources, passages, claims, suggestions }) {
  const totalSources = sources.length;
  const totalPassages = passages.length;
  const totalClaims = claims.length;
  const totalSuggestions = suggestions.length;
  const sourceIdsWithPassages = new Set(passages.map(item => item.sourceId));
  const sourceIds = new Set(sources.map(item => item.id));
  const passageIds = new Set(passages.map(item => item.id));

  const countBy = (items, field) => items.reduce((counts, item) => {
    const key = String(item[field] ?? "UNKNOWN");
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      sources: totalSources,
      passages: totalPassages,
      claims: totalClaims,
      suggestions: totalSuggestions,
      distinctSourcesRepresentedByPassages: sourceIdsWithPassages.size
    },
    review: {
      sourcesReviewedByHuman: sources.filter(item => item.humanReviewed === true).length,
      sourcesUnreviewed: sources.filter(item => item.humanReviewed !== true).length,
      passagesReviewedByHuman: passages.filter(item => item.reviewedByHuman === true).length,
      passagesUnreviewed: passages.filter(item => item.reviewedByHuman !== true).length,
      claimsReviewedByHuman: claims.filter(item => item.reviewedByHuman === true).length,
      claimsUnreviewed: claims.filter(item => item.reviewedByHuman !== true).length
    },
    sourceCoverage: {
      sourcesWithoutUrl: sources.filter(item => !String(item.url ?? "").trim()).length,
      sourcesWithoutPassages: sources.filter(item => !sourceIdsWithPassages.has(item.id)).length,
      sourcesWithPassages: sourceIdsWithPassages.size,
      extractionStatusCounts: countBy(sources, "extractionStatus"),
      accessStatusCounts: countBy(sources, "accessStatus")
    },
    workflow: {
      suggestionStatusCounts: countBy(suggestions, "status"),
      claimStatusCounts: countBy(claims, "status")
    },
    integrityWarnings: {
      passagesWithMissingSource: passages.filter(item => !sourceIds.has(item.sourceId)).length,
      claimsWithMissingSource: claims.filter(item => item.sourceId && !sourceIds.has(item.sourceId)).length,
      claimsWithMissingEntity: claims.filter(item => item.entityId && !item.entityExists).length,
      suggestionsWithMissingSource: suggestions.filter(item => !sourceIds.has(item.sourceId)).length,
      suggestionsWithMissingPassage: suggestions.filter(item => !passageIds.has(item.passageId)).length
    },
    limitations: [
      "هذا تدقيق عددي لقاعدة البيانات الحالية فقط؛ لا يثبت صحة محتوى أي مصدر أو نسب.",
      "المصدر أو المقطع غير المراجع لا يُعامل كدليل تاريخي معتمد.",
      "لا تُنشأ أو تُعدّل كيانات أو دعاوى أو علاقات أو حالات مراجعة."
    ]
  };
}

async function main() {
  const [sources, passages, claims, suggestions] = await Promise.all([
    prisma.source.findMany({
      select: { id: true, url: true, humanReviewed: true, extractionStatus: true, accessStatus: true }
    }),
    prisma.evidencePassage.findMany({
      select: { id: true, sourceId: true, reviewedByHuman: true }
    }),
    prisma.historicalClaim.findMany({
      select: { sourceId: true, entityId: true, status: true, reviewedByHuman: true, entity: { select: { id: true } } }
    }),
    prisma.researchSuggestion.findMany({
      select: { sourceId: true, passageId: true, status: true }
    })
  ]);

  const audit = buildResearchCorpusAudit({
    sources,
    passages,
    claims: claims.map(({ entity, ...claim }) => ({ ...claim, entityExists: Boolean(entity) })),
    suggestions
  });
  process.stdout.write(JSON.stringify(audit, null, 2) + "\n");
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main()
    .catch(error => {
      process.stderr.write((error instanceof Error ? error.message : "Research corpus audit failed") + "\n");
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
