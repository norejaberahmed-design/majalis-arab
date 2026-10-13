import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const example = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

describe("tracked environment example safety", () => {
  it("keeps secret-bearing environment variables empty", () => {
    for (const name of [
      "BETTER_AUTH_SECRET",
      "SMTP_PASS",
      "OPENAI_API_KEY",
      "GOOGLE_CLIENT_SECRET"
    ]) {
      expect(example, `${name} must stay blank in .env.example`).toMatch(
        new RegExp(`^${name}=""$`, "m")
      );
    }
  });

  it("does not contain a provider API-key-shaped value", () => {
    expect(example).not.toMatch(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/);
  });
});
