import { describe, expect, it } from "vitest";
import { extractNameCandidates, normalizeArabicName } from "./extract-tribal-name-candidates.mjs";

describe("tribal name candidate extraction", () => {
  it("finds explicit tribal markers and preserves the supporting sentence", () => {
    const text = "ذكر المؤلف قبيلة قريش في هذا الموضع. ثم انتقل إلى موضوع آخر.";
    const candidates = extractNameCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe("قريش");
    expect(candidates[0].quote).toBe("ذكر المؤلف قبيلة قريش في هذا الموضع");
  });

  it("finds Banu/Al phrasing without creating genealogy claims", () => {
    const candidates = extractNameCandidates("وتذكر الرواية بني تميم وآل ربيعة في سياق الخبر.");
    expect(candidates.map(candidate => normalizeArabicName(candidate.name))).toContain("تميم");
    expect(candidates.map(candidate => normalizeArabicName(candidate.name))).toContain("ربيعة");
  });

  it("deduplicates spelling variants within the same passage", () => {
    const candidates = extractNameCandidates("قبيلة قريش ثم وردت قبيلة قُرَيْش في السرد.");
    expect(candidates.filter(candidate => normalizeArabicName(candidate.name) === "قريش")).toHaveLength(1);
  });

  it("does not infer a name when no explicit marker exists", () => {
    expect(extractNameCandidates("هذا نص تاريخي عام لا يذكر اسم قبيلة صراحة.")).toEqual([]);
  });
});
