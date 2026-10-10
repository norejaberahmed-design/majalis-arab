import { describe, expect, it } from "vitest";
import { validateWikisourceBatch } from "./fetch-wikisource-batch.mjs";

describe("Wikisource batch manifest validation", () => {
  it("normalizes valid Arabic Wikisource page URLs", () => {
    expect(validateWikisourceBatch({
      pages: [{ url: "https://ar.wikisource.org/wiki/صفة_جزيرة_العرب/الجزء_الأول" }]
    }).pages).toEqual([{
      url: "https://ar.wikisource.org/wiki/%D8%B5%D9%81%D8%A9_%D8%AC%D8%B2%D9%8A%D8%B1%D8%A9_%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%2F%D8%A7%D9%84%D8%AC%D8%B2%D8%A1_%D8%A7%D9%84%D8%A3%D9%88%D9%84",
      title: "صفة جزيرة العرب/الجزء الأول"
    }]);
  });

  it("rejects non-Wikisource URLs before any fetch begins", () => {
    expect(() => validateWikisourceBatch({
      pages: [{ url: "https://example.org/book" }]
    })).toThrow("المسموح حاليًا");
  });

  it("rejects duplicate pages", () => {
    expect(() => validateWikisourceBatch({
      pages: [
        { url: "https://ar.wikisource.org/wiki/صفة_جزيرة_العرب" },
        { url: "https://ar.wikisource.org/wiki/صفة_جزيرة_العرب" }
      ]
    })).toThrow("الرابط مكرر");
  });

  it("enforces the maximum batch size", () => {
    expect(() => validateWikisourceBatch({
      pages: Array.from({ length: 26 }, (_, i) => ({
        url: `https://ar.wikisource.org/wiki/كتاب_${i}`
      }))
    })).toThrow("صفحة واحدة إلى 25 صفحة");
  });

  it("rejects malformed manifests", () => {
    expect(() => validateWikisourceBatch({ items: [] })).toThrow("صيغة الملف غير صحيحة");
  });
});
