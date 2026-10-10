import { describe, expect, it } from "vitest";
import { cleanWikiExtract, parseWikisourcePageUrl, splitPassages } from "./fetch-wikisource-text.mjs";

describe("Wikisource page ingestion helpers", () => {
  it("accepts only Arabic Wikisource HTTPS page URLs", () => {
    expect(parseWikisourcePageUrl("https://ar.wikisource.org/wiki/صفة_جزيرة_العرب").title).toBe("صفة جزيرة العرب");
    expect(() => parseWikisourcePageUrl("https://example.com/wiki/book")).toThrow();
    expect(() => parseWikisourcePageUrl("http://ar.wikisource.org/wiki/book")).toThrow();
    expect(() => parseWikisourcePageUrl("https://ar.wikisource.org.evil.example/wiki/book")).toThrow();
  });

  it("cleans whitespace without rewriting the source words", () => {
    expect(cleanWikiExtract("  نص  \r\n\n\n فقرة  ")).toBe("نص\n\n فقرة");
  });

  it("splits large text into bounded, ordered chunks", () => {
    const chunks = splitPassages("أ".repeat(12) + "\n\n" + "ب".repeat(12), 10);
    expect(chunks.join("")).toBe("أ".repeat(12) + "ب".repeat(12));
    expect(chunks.every(chunk => chunk.length <= 10)).toBe(true);
  });

  it("returns no passage for empty text", () => {
    expect(splitPassages(" \n \n ")).toEqual([]);
  });
});
