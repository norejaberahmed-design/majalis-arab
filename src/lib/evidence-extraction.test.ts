import { describe, expect, it } from "vitest";
import { validateEvidenceDrafts } from "./evidence-extraction";

const excerpt = "ذكر المؤرخ أن القبيلة نزلت الوادي في عام ١٢٠٠، ثم انتقلت إلى المنطقة المجاورة.";

describe("evidence-grounded extraction", () => {
  it("accepts only claims with an exact quote from the source excerpt", () => {
    const result = validateEvidenceDrafts({
      suggestions: [
        { statement: "نزلت القبيلة الوادي في عام ١٢٠٠", evidenceQuote: "القبيلة نزلت الوادي في عام ١٢٠٠" },
        { statement: "تنتمي القبيلة إلى نسب محدد", evidenceQuote: "لا يوجد هذا النص في المصدر" }
      ]
    }, excerpt);
    expect(result).toHaveLength(1);
    expect(result[0].evidenceQuote).toBe("القبيلة نزلت الوادي في عام ١٢٠٠");
  });

  it("rejects malformed, short, duplicated, and unsupported suggestions", () => {
    expect(validateEvidenceDrafts({ suggestions: "not an array" }, excerpt)).toEqual([]);
    expect(validateEvidenceDrafts({ suggestions: [
      { statement: "قصير", evidenceQuote: "ذكر المؤرخ" },
      { statement: "ادعاء تاريخي واضح", evidenceQuote: "هذا اقتباس مختلق تمامًا" }
    ] }, excerpt)).toEqual([]);
    expect(validateEvidenceDrafts({ suggestions: [
      { statement: "نزلت القبيلة الوادي في عام ١٢٠٠", evidenceQuote: "القبيلة نزلت الوادي في عام ١٢٠٠" },
      { statement: "نزلت القبيلة الوادي في عام ١٢٠٠", evidenceQuote: "القبيلة نزلت الوادي في عام ١٢٠٠" }
    ] }, excerpt)).toHaveLength(1);
  });
});
