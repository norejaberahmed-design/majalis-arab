import { describe, expect, it } from "vitest";
import { auditCandidateCorpus, loadCandidateCorpus } from "./audit-genealogy-candidate-corpus.mjs";

describe("Arabic genealogy candidate corpus", () => {
  it("loads the source-attributed batches without importing them as facts", () => {
    const report = auditCandidateCorpus(loadCandidateCorpus());
    expect(report.datasets).toBe(8);
    expect(report.candidateRecords).toBe(170);
    expect(report.recordsWithoutName).toBe(0);
    expect(report.recordsWithoutSourceUrl).toBe(0);
    expect(report.recordsWithoutReviewStatus).toBe(0);
    expect(report.recordsMarkedVerified).toBe(0);
    expect(report.safetyNote).toContain("لا يستورد سجلات");
  });
});
