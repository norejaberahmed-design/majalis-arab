import { describe, expect, it } from "vitest";
import { councilCommentSchema, councilPostSchema } from "./council-content";

describe("community content validation", () => {
  it("trims valid posts and comments", () => {
    expect(councilPostSchema.parse({ content: "  مساء الخير  " }).content).toBe("مساء الخير");
    expect(councilCommentSchema.parse({ content: "  أتفق معك  " }).content).toBe("أتفق معك");
  });

  it("rejects blank content", () => {
    expect(councilPostSchema.safeParse({ content: "  " }).success).toBe(false);
    expect(councilCommentSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("enforces content length limits", () => {
    expect(councilPostSchema.safeParse({ content: "x".repeat(5001) }).success).toBe(false);
    expect(councilCommentSchema.safeParse({ content: "x".repeat(2001) }).success).toBe(false);
  });
});
