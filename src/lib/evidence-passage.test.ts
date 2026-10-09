import { describe, expect, it } from "vitest";
import { evidencePassageInputSchema } from "./evidence-passage";

describe("evidence passage input", () => {
  it("requires a precise page or location and a substantive excerpt", () => {
    expect(evidencePassageInputSchema.safeParse({
      pageLabel: "ص ٢٣",
      passageText: "نص مقتبس من المصدر للاختبار",
    }).success).toBe(true);
  });

  it("rejects missing page labels, short excerpts, and oversized text", () => {
    expect(evidencePassageInputSchema.safeParse({ pageLabel: "", passageText: "نص كافٍ للاختبار" }).success).toBe(false);
    expect(evidencePassageInputSchema.safeParse({ pageLabel: "ص ٢", passageText: "قصير" }).success).toBe(false);
    expect(evidencePassageInputSchema.safeParse({ pageLabel: "ص ٢", passageText: "ن".repeat(5001) }).success).toBe(false);
  });

  it("bounds optional locator and entity identifiers", () => {
    expect(evidencePassageInputSchema.safeParse({ pageLabel: "ص ٢", passageText: "نص مقتبس من المصدر للاختبار", locator: "الفصل الأول", entityId: "entity_1" }).success).toBe(true);
    expect(evidencePassageInputSchema.safeParse({ pageLabel: "ص ٢", passageText: "نص مقتبس من المصدر للاختبار", locator: "ل".repeat(501) }).success).toBe(false);
  });
});
