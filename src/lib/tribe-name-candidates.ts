import initialEntities from "../../data/seeds/initial-tribal-entities.json";
import batch02 from "../../data/seeds/kahala-additional-candidates-batch-02.json";
import batch03 from "../../data/seeds/kahala-additional-candidates-batch-03.json";
import batch04 from "../../data/seeds/kahala-additional-candidates-batch-04.json";
import batch05 from "../../data/seeds/kahala-additional-candidates-batch-05.json";
import batch06 from "../../data/seeds/kahala-additional-candidates-batch-06.json";
import batch07 from "../../data/seeds/kahala-additional-candidates-batch-07.json";
import webCandidates from "../../data/seeds/kahala-web-candidates.json";
import { normalizeName } from "@/lib/validation";

type SourceRecord = {
  name?: string;
  name_as_published?: string;
  entity_kind?: string;
  evidence_summary?: string | null;
  evidence_excerpt?: string | null;
  source_url?: string;
  source_locator?: string | null;
  locator_type?: string;
  printed_page?: number | null;
  pdf_page?: number | null;
  review_status?: string;
  notes?: string | null;
  candidate_id?: string;
};

type Dataset = {
  entities?: SourceRecord[];
  candidates?: SourceRecord[];
};

export type TribeNameCandidate = {
  id: string;
  name: string;
  entityKind: string;
  evidence: string;
  sourceUrl: string;
  sourceLocator: string;
  reviewStatus: string;
};

function datasetEntries(dataset: Dataset, sourceId: string): TribeNameCandidate[] {
  const records = dataset.entities ?? dataset.candidates ?? [];
  return records.flatMap((record, index) => {
    const name = (record.name ?? record.name_as_published ?? "").trim();
    if (!name || !record.source_url) return [];
    const locatorParts = [
      record.source_locator,
      record.printed_page ? `صفحة مطبوعة ${record.printed_page}` : null,
      record.pdf_page ? `صفحة PDF ${record.pdf_page}` : null,
      record.locator_type === "web_page" ? "صفحة ويب رقمية وليست رقم صفحة مطبوعة" : null
    ].filter((value): value is string => Boolean(value));
    return [{
      id: record.candidate_id ?? `${sourceId}-${index + 1}-${name}`,
      name,
      entityKind: record.entity_kind ?? "UNRESOLVED",
      evidence: (record.evidence_summary ?? record.evidence_excerpt ?? record.notes ?? "").trim(),
      sourceUrl: record.source_url,
      sourceLocator: locatorParts.join(" · "),
      reviewStatus: record.review_status ?? "UNREVIEWED"
    }];
  });
}

export const tribeNameCandidates: TribeNameCandidate[] = [
  ...datasetEntries(initialEntities as Dataset, "initial"),
  ...datasetEntries(batch02 as Dataset, "kahala-02"),
  ...datasetEntries(batch03 as Dataset, "kahala-03"),
  ...datasetEntries(batch04 as Dataset, "kahala-04"),
  ...datasetEntries(batch05 as Dataset, "kahala-05"),
  ...datasetEntries(batch06 as Dataset, "kahala-06"),
  ...datasetEntries(batch07 as Dataset, "kahala-07"),
  ...datasetEntries(webCandidates as Dataset, "kahala-web")
];

export function searchTribeNameCandidates(query: string, limit = 24): TribeNameCandidate[] {
  const normalizedQuery = normalizeName(query);
  const matches = normalizedQuery
    ? tribeNameCandidates.filter(candidate => normalizeName(candidate.name).includes(normalizedQuery))
    : tribeNameCandidates;
  return matches
    .slice()
    .sort((left, right) => {
      const leftExact = normalizedQuery && normalizeName(left.name) === normalizedQuery ? 0 : 1;
      const rightExact = normalizedQuery && normalizeName(right.name) === normalizedQuery ? 0 : 1;
      return leftExact - rightExact || left.name.localeCompare(right.name, "ar");
    })
    .slice(0, limit);
}
