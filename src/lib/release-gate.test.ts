import { describe, expect, it } from "vitest";
import { shouldBlockProduction } from "./release-gate";

describe("production release gate", () => {
  it("blocks production until authentication and data isolation are implemented", () => {
    expect(shouldBlockProduction("production")).toBe(true);
  });

  it("keeps local development available", () => {
    expect(shouldBlockProduction("development")).toBe(false);
    expect(shouldBlockProduction("test")).toBe(false);
  });
});
