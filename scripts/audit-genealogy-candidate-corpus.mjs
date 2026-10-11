import { readFileSync } from "node:fs";

export const CANDIDATE_FILES = [
  "initial-tribal-entities.json",
  "kahala-additional-candidates-batch-02.json",
  "kahala-additional-candidates-batch-03.json",
  "kahala-additional-candidates-batch-04.json",
  "kahala-additional-candidates-batch-05.json",
  "kahala-additional-candidates-batch-06.json",
  "kahala-additional-candidates-batch-07.json",
  "kahala-web-candidates.json"
];

export function auditCandidateCorpus(datasets) {
  const records = [];
  for (const dataset of datasets) {
    const rows = Array.isArray(dataset.entities) ? dataset.entities
      : Array.isArray(dataset.candidates) ? dataset.candidates : [];
    for (const row of rows) records.push({
      name: row.name ?? row.name_as_published ?? row.candidateName ?? "",
      sourceUrl: row.source_url ?? row.sourceUrl ?? "",
      status: row.review_status ?? row.reviewStatus ?? "",
      entityKind: row.entity_kind ?? row.entity_kind ?? "UNRESOLVED",
      datasetStatus: dataset.dataset_status ?? "UNKNOWN"
    });
  }

  const duplicateNames = new Map();
  for (const record of records) {
    const key = String(record.name).trim();
    if (!key) continue;
    duplicateNames.set(key, (duplicateNames.get(key) ?? 0) + 1);
  }

  return {
    datasets: datasets.length,
    candidateRecords: records.length,
    recordsWithoutName: records.filter(item => !String(item.name).trim()).length,
    recordsWithoutSourceUrl: records.filter(item => !String(item.sourceUrl).trim()).length,
    recordsWithoutReviewStatus: records.filter(item => !String(item.status).trim()).length,
    recordsMarkedVerified: records.filter(item => /^(VERIFIED|APPROVED|SUPPORTED)$/i.test(String(item.status))).length,
    reviewStatusCounts: records.reduce((counts, item) => {
      const key = item.status || "MISSING";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
    exactDuplicateNamesForReview: [...duplicateNames.entries()].filter(([, count]) => count > 1).map(([name, count]) => ({ name, count })),
    safetyNote: "هذا فهرس مرشحين بحثيين فقط؛ لا يستورد سجلات إلى قاعدة البيانات ولا يثبت أن كل اسم قبيلة مستقلة أو أنسابًا تاريخية."
  };
}

export function loadCandidateCorpus() {
  return CANDIDATE_FILES.map(file => JSON.parse(
    readFileSync(new URL(`../data/seeds/${file}`, import.meta.url), "utf8")
  ));
}

async function main() {
  const report = auditCandidateCorpus(loadCandidateCorpus());
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (report.recordsWithoutName || report.recordsWithoutSourceUrl || report.recordsWithoutReviewStatus || report.recordsMarkedVerified) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(error => {
    process.stderr.write((error instanceof Error ? error.message : "Candidate corpus audit failed") + "\n");
    process.exitCode = 1;
  });
}
