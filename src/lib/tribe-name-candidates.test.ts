import { describe, expect, it } from "vitest";
import { searchTribeNameCandidates, tribeNameCandidates } from "./tribe-name-candidates";

describe("source-attributed tribe name candidate index", () => {
  it("loads all committed candidate records without converting them into verified entities", () => {
    expect(tribeNameCandidates).toHaveLength(170);
    expect(tribeNameCandidates.every(candidate => candidate.name.length > 0)).toBe(true);
    expect(tribeNameCandidates.every(candidate => candidate.sourceUrl.startsWith("https://"))).toBe(true);
    expect(tribeNameCandidates.every(candidate => candidate.reviewStatus !== "VERIFIED")).toBe(true);
  });

  it("finds Arabic names while ignoring diacritics and common letter variants", () => {
    const results = searchTribeNameCandidates("عنزه");
    expect(results.some(candidate => candidate.name === "عنزة")).toBe(true);
  });

  it("returns source metadata and evidence summaries for matched candidates", () => {
    const result = searchTribeNameCandidates("بنو هاجر").find(candidate => candidate.name === "بنو هاجر");
    expect(result).toBeDefined();
    expect(result?.sourceUrl).toContain("https://");
    expect(result?.evidence.length).toBeGreaterThan(0);
    expect(result?.reviewStatus).toContain("HUMAN_REVIEW");
  });

  it("caps directory results and does not merge similarly named source records", () => {
    expect(searchTribeNameCandidates("", 24)).toHaveLength(24);
    const similar = searchTribeNameCandidates("قطن", 24);
    expect(similar.length).toBeGreaterThan(1);
    expect(new Set(similar.map(candidate => candidate.id)).size).toBe(similar.length);
  });
});
