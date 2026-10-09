import { describe, expect, it } from "vitest";
import { workspaceEntityNoteSchema } from "./workspace-entity-note";

describe("workspaceEntityNoteSchema", () => {
  it("accepts a non-empty bounded note and trims whitespace", () => {
    expect(workspaceEntityNoteSchema.parse({ note: "  يحتاج إلى تحقق  " }).note).toBe("يحتاج إلى تحقق");
  });

  it("rejects blank and oversized notes", () => {
    expect(workspaceEntityNoteSchema.safeParse({ note: "   " }).success).toBe(false);
    expect(workspaceEntityNoteSchema.safeParse({ note: "x".repeat(5001) }).success).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(workspaceEntityNoteSchema.safeParse({ note: 123 }).success).toBe(false);
    expect(workspaceEntityNoteSchema.safeParse({}).success).toBe(false);
  });
});
