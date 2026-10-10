import { describe, expect, it } from "vitest";
import { normalizeArabicName, validateManifest } from "./import-source-batch.mjs";

const validManifest = {
  sources: [{
    title: "صفة جزيرة العرب",
    author: "الهمداني",
    url: "https://example.org/book",
    accessNote: "نص متاح للفهرسة، ويحتاج إلى التحقق من النسخة والموضع.",
    passages: [{
      pageLabel: "الجزء الأول، فقرة تقسيم الجزيرة",
      text: "نص منقول من المصدر ويحتاج إلى مطابقة الموضع قبل اعتماده.",
      locator: "https://example.org/book#section"
    }]
  }]
};

describe("source batch import validation", () => {
  it("accepts a source passage with provenance and preserves it as a manifest", () => {
    const result = validateManifest(validManifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sources[0].passages[0].text).toBe(validManifest.sources[0].passages[0].text);
      expect(result.data.sources[0].accessNote).toContain("التحقق");
    }
  });

  it("rejects unsafe URL schemes", () => {
    const result = validateManifest({
      ...validManifest,
      sources: [{ ...validManifest.sources[0], url: "javascript:alert(1)" }]
    });
    expect(result.ok).toBe(false);
  });

  it("rejects passages without a locator label or source context", () => {
    const result = validateManifest({
      sources: [{
        ...validManifest.sources[0],
        passages: [{ pageLabel: "", text: "هذا نص صالح من حيث الطول لكنه بلا موضع واضح." }]
      }]
    });
    expect(result.ok).toBe(false);
  });

  it("normalizes clear Arabic spelling variants without inferring relationships", () => {
    expect(normalizeArabicName("  آلُ بَنِيـ أَحْمَد  ")).toBe("ال بني احمد");
    expect(normalizeArabicName("قبيلة   قريش")).toBe("قبيلة قريش");
  });
});
