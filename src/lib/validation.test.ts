import { describe, expect, it } from "vitest";
import { entityInputSchema, normalizeName } from "./validation";

describe("normalizeName", () => {
  it("normalizes Arabic letter variants and diacritics", () => {
    expect(normalizeName("  إِبْرَاهِيم  ")).toBe("ابراهيم");
    expect(normalizeName("الفتى")).toBe("الفتى".replace("ى", "ي"));
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeName("بنو   تميم")).toBe("بنو تميم");
  });
});

describe("entityInputSchema", () => {
  it("accepts a minimal valid entity", () => {
    expect(entityInputSchema.safeParse({ name: "بنو تميم", kind: "TRIBE" }).success).toBe(true);
  });

  it("rejects an invalid kind and an empty name", () => {
    expect(entityInputSchema.safeParse({ name: "", kind: "UNKNOWN" }).success).toBe(false);
  });

  it("rejects overlong notes", () => {
    expect(entityInputSchema.safeParse({ name: "اسم صحيح", kind: "OTHER", notes: "ن".repeat(5001) }).success).toBe(false);
  });
});