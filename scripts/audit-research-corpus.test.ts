import { describe, expect, it } from "vitest";
import { buildResearchCorpusAudit } from "./audit-research-corpus.mjs";

describe("research corpus audit", () => {
  it("counts unique sources separately from passages and review states", () => {
    const result = buildResearchCorpusAudit({
      sources: [
        { id: "s1", url: "https://example.org/a", humanReviewed: false, extractionStatus: "DONE", accessStatus: "CHECKED" },
        { id: "s2", url: "", humanReviewed: true, extractionStatus: "NOT_ATTEMPTED", accessStatus: "NOT_CHECKED" }
      ],
      passages: [
        { id: "p1", sourceId: "s1", reviewedByHuman: false },
        { id: "p2", sourceId: "s1", reviewedByHuman: true }
      ],
      claims: [
        { sourceId: "s1", entityId: null, entityExists: false, status: "UNREVIEWED", reviewedByHuman: false }
      ],
      suggestions: [
        { sourceId: "s1", passageId: "p1", status: "PENDING" }
      ]
    });

    expect(result.totals).toMatchObject({
      sources: 2, passages: 2, claims: 1, suggestions: 1,
      distinctSourcesRepresentedByPassages: 1
    });
    expect(result.review).toMatchObject({
      sourcesReviewedByHuman: 1, sourcesUnreviewed: 1,
      passagesReviewedByHuman: 1, passagesUnreviewed: 1,
      claimsReviewedByHuman: 0, claimsUnreviewed: 1
    });
    expect(result.sourceCoverage).toMatchObject({
      sourcesWithoutUrl: 1, sourcesWithoutPassages: 1, sourcesWithPassages: 1
    });
    expect(result.workflow.suggestionStatusCounts).toEqual({ PENDING: 1 });
  });

  it("reports broken source and passage references without mutating records", () => {
    const result = buildResearchCorpusAudit({
      sources: [{ id: "s1", url: "", humanReviewed: false, extractionStatus: "NOT_ATTEMPTED", accessStatus: "NOT_CHECKED" }],
      passages: [{ id: "p1", sourceId: "missing-source", reviewedByHuman: false }],
      claims: [
        { sourceId: "missing-source", entityId: "missing-entity", entityExists: false, status: "UNREVIEWED", reviewedByHuman: false }
      ],
      suggestions: [{ sourceId: "s1", passageId: "missing-passage", status: "PENDING" }]
    });

    expect(result.integrityWarnings).toEqual({
      passagesWithMissingSource: 1,
      claimsWithMissingSource: 1,
      claimsWithMissingEntity: 1,
      suggestionsWithMissingSource: 0,
      suggestionsWithMissingPassage: 1
    });
  });

  it("handles an empty corpus", () => {
    const result = buildResearchCorpusAudit({ sources: [], passages: [], claims: [], suggestions: [] });
    expect(result.totals).toMatchObject({ sources: 0, passages: 0, claims: 0, suggestions: 0 });
    expect(result.sourceCoverage.sourcesWithoutPassages).toBe(0);
  });
});
