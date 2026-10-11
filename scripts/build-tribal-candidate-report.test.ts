import { describe, expect, it } from "vitest";
import { buildCrossSourceReport } from "./build-tribal-candidate-report.mjs";

const passage = (id, sourceId, title, passageText, extras = {}) => ({
  id,
  sourceId,
  passageText,
  pageLabel: extras.pageLabel ?? "ص ١٢",
  locator: extras.locator ?? null,
  reviewedByHuman: false,
  source: {
    title,
    url: `https://example.org/${sourceId}`,
    author: "مؤلف",
    edition: "طبعة اختبار",
    humanReviewed: false
  }
});

describe("cross-source tribal candidate report", () => {
  it("counts unique source IDs separately from passage count", () => {
    const result = buildCrossSourceReport([
      passage("p1", "s1", "المصدر الأول", "ذكر قبيلة قريش في هذا الموضع."),
      passage("p2", "s1", "المصدر الأول", "ثم ذكر قبيلة قريش في موضع آخر."),
      passage("p3", "s2", "المصدر الثاني", "وأشار المؤلف إلى قبيلة قريش.")
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].normalizedName).toBe("قريش");
    expect(result[0].passageCount).toBe(3);
    expect(result[0].distinctSourceCount).toBe(2);
    expect(result[0].evidence).toHaveLength(3);
  });

  it("preserves source URL, passage locator, quote, and human review flags", () => {
    const result = buildCrossSourceReport([
      passage("p1", "s1", "كتاب التاريخ", "ذكر قبيلة تميم في سياق الخبر.", {
        pageLabel: "باب الأنساب",
        locator: "https://example.org/book#page=8"
      })
    ]);

    expect(result[0].evidence[0]).toMatchObject({
      sourceId: "s1",
      sourceTitle: "كتاب التاريخ",
      sourceUrl: "https://example.org/s1",
      passageId: "p1",
      pageLabel: "باب الأنساب",
      locator: "https://example.org/book#page=8",
      quote: "ذكر قبيلة تميم في سياق الخبر",
      passageReviewedByHuman: false,
      sourceHumanReviewed: false
    });
  });

  it("normalizes spelling only for grouping and preserves variants", () => {
    const result = buildCrossSourceReport([
      passage("p1", "s1", "مصدر أ", "ذكر قبيلة إعراب في النص."),
      passage("p2", "s2", "مصدر ب", "ذكر قبيلة اعراب في النص.")
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].normalizedName).toBe("اعراب");
    expect(result[0].nameVariants).toContain("إعراب");
    expect(result[0].nameVariants).toContain("اعراب");
    expect(result[0].interpretationWarning).toContain("لا يثبت");
  });

  it("does not create groups when no explicit candidate markers exist", () => {
    expect(buildCrossSourceReport([
      passage("p1", "s1", "مصدر", "نص عام عن الأسواق والطرق.")
    ])).toEqual([]);
  });
});
