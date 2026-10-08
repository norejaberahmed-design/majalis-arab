import { describe, expect, it } from "vitest";
import { hasTrustedOrigin, roleAtLeast } from "./access-control";

describe("workspace role hierarchy", () => {
  it("allows roles at or above the required level", () => {
    expect(roleAtLeast("OWNER", "EDITOR")).toBe(true);
    expect(roleAtLeast("EDITOR", "EDITOR")).toBe(true);
    expect(roleAtLeast("REVIEWER", "VIEWER")).toBe(true);
  });

  it("denies lower or unknown roles", () => {
    expect(roleAtLeast("VIEWER", "EDITOR")).toBe(false);
    expect(roleAtLeast("REVIEWER", "OWNER")).toBe(false);
    expect(roleAtLeast("ADMIN", "OWNER")).toBe(false);
  });
});

describe("state-changing request origin checks", () => {
  it("accepts a same-origin HTTPS request", () => {
    const request = new Request("https://majalis.example/api/workspaces", {
      method: "POST",
      headers: { origin: "https://majalis.example", host: "majalis.example" }
    });
    expect(hasTrustedOrigin(request)).toBe(true);
  });

  it("rejects a foreign origin and missing origin", () => {
    expect(hasTrustedOrigin(new Request("https://majalis.example/api/workspaces", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "majalis.example" }
    }))).toBe(false);
    expect(hasTrustedOrigin(new Request("https://majalis.example/api/workspaces", {
      method: "POST",
      headers: { host: "majalis.example" }
    }))).toBe(false);
  });

  it("allows local development origins only on localhost", () => {
    expect(hasTrustedOrigin(new Request("http://localhost:3000/api", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" }
    }))).toBe(true);
    expect(hasTrustedOrigin(new Request("http://majalis.example/api", {
      method: "POST",
      headers: { origin: "http://majalis.example", host: "majalis.example" }
    }))).toBe(false);
  });
});
