import { describe, expect, it } from "vitest";
import { normalizeSearchResult, validateDiscoveryOptions } from "./discover-arabic-history-sources.mjs";

describe("Arabic history source discovery", () => {
  it("validates and deduplicates queries", () => {
    expect(validateDiscoveryOptions({ queries: ["أنساب العرب", " أنساب العرب "], limit: 3 }))
      .toEqual({ queries: ["أنساب العرب"], limit: 3 });
  });

  it("rejects excessive or malformed options", () => {
    expect(() => validateDiscoveryOptions({ queries: [], limit: 2 })).toThrow();
    expect(() => validateDiscoveryOptions({ queries: ["x"], limit: 2 })).toThrow();
    expect(() => validateDiscoveryOptions({ queries: ["أنساب العرب"], limit: 11 })).toThrow();
  });

  it("creates a canonical Arabic Wikisource URL and labels results as unverified candidates", () => {
    const result = normalizeSearchResult({
      title: "صفة جزيرة العرب/الجزء الأول",
      pageid: 42,
      ns: 0,
      snippet: "ذكر <b>القبائل</b> العربية"
    }, "صفة جزيرة العرب");
    expect(result.url).toBe("https://ar.wikisource.org/wiki/صفة_جزيرة_العرب/الجزء_الأول");
    expect(result.snippet).toBe("ذكر القبائل العربية");
    expect(result.status).toBe("CANDIDATE_REQUIRES_BIBLIOGRAPHIC_REVIEW");
    expect(result.warning).toContain("لا تثبت");
  });

  it("ignores malformed search results", () => {
    expect(normalizeSearchResult(null, "بحث")).toBeNull();
    expect(normalizeSearchResult({ title: " " }, "بحث")).toBeNull();
  });
});
