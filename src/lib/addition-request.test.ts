import { describe, expect, it } from "vitest";
import { additionRequestSchema } from "./addition-request";

describe("additionRequestSchema", () => {
  const valid = {
    proposedName: "قبيلة افتراضية للاختبار",
    proposedKind: "TRIBE",
    explanation: "اقتراح يحتاج إلى مراجعة المصدر قبل اعتماده في السجل.",
    sourceUrl: "https://example.org/source"
  };

  it("accepts a bounded Arabic entity proposal", () => {
    expect(additionRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects short names and explanations", () => {
    expect(additionRequestSchema.safeParse({ ...valid, proposedName: "أ" }).success).toBe(false);
    expect(additionRequestSchema.safeParse({ ...valid, explanation: "قصير" }).success).toBe(false);
  });

  it("rejects unknown entity kinds and oversized input", () => {
    expect(additionRequestSchema.safeParse({ ...valid, proposedKind: "ADMIN" }).success).toBe(false);
    expect(additionRequestSchema.safeParse({ ...valid, explanation: "x".repeat(3001) }).success).toBe(false);
    expect(additionRequestSchema.safeParse({ ...valid, proposedName: "x".repeat(161) }).success).toBe(false);
  });

  it("allows an omitted or empty source URL", () => {
    expect(additionRequestSchema.safeParse({ ...valid, sourceUrl: "" }).success).toBe(true);
    const { sourceUrl: _sourceUrl, ...withoutSource } = valid;
    expect(additionRequestSchema.safeParse(withoutSource).success).toBe(true);
  });
});
