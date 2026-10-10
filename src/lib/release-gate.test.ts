import { describe, expect, it } from "vitest";
import { isAllowedDuringReleaseGate, shouldBlockProduction } from "./release-gate";

describe("production release gate", () => {
  it("blocks production until authentication and data isolation are implemented", () => {
    expect(shouldBlockProduction("production")).toBe(true);
  });

  it("keeps local development available", () => {
    expect(shouldBlockProduction("development")).toBe(false);
    expect(shouldBlockProduction("test")).toBe(false);
  });

  it("allows only the authentication and workspace setup surface while production is gated", () => {
    expect(isAllowedDuringReleaseGate("/")).toBe(true);
    expect(isAllowedDuringReleaseGate("/login")).toBe(true);
    expect(isAllowedDuringReleaseGate("/setup")).toBe(true);
    expect(isAllowedDuringReleaseGate("/forgot-password")).toBe(true);
    expect(isAllowedDuringReleaseGate("/reset-password")).toBe(true);
    expect(isAllowedDuringReleaseGate("/api/auth/sign-in/email")).toBe(true);
    expect(isAllowedDuringReleaseGate("/api/workspaces")).toBe(true);
    expect(isAllowedDuringReleaseGate("/api/workspaces/active")).toBe(true);
    expect(isAllowedDuringReleaseGate("/entities")).toBe(false);
    expect(isAllowedDuringReleaseGate("/api/entities")).toBe(false);
    expect(isAllowedDuringReleaseGate("/api/workspaces/secret")).toBe(false);
  });
});
