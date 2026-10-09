import { describe, expect, it } from "vitest";
import { isCatalogueCurator, sourceInputSchema } from "./source-intake";

describe("source intake", () => {
  it("accepts a minimally described bibliographic source without pretending it was reviewed", () => {
    expect(sourceInputSchema.safeParse({ title: "تاريخ مثال" }).success).toBe(true);
  });

  it("rejects empty titles, overlong fields, and invalid publication years", () => {
    expect(sourceInputSchema.safeParse({ title: " " }).success).toBe(false);
    expect(sourceInputSchema.safeParse({ title: "كتاب", publicationYear: 2200 }).success).toBe(false);
    expect(sourceInputSchema.safeParse({ title: "كتاب", author: "أ".repeat(201) }).success).toBe(false);
  });

  it("only authorizes explicitly allowlisted curator emails", () => {
    expect(isCatalogueCurator("Researcher@example.com", "researcher@example.com, editor@example.com")).toBe(true);
    expect(isCatalogueCurator("outsider@example.com", "researcher@example.com")).toBe(false);
    expect(isCatalogueCurator("researcher@example.com", undefined)).toBe(false);
    expect(isCatalogueCurator(null, "researcher@example.com")).toBe(false);
  });
});
