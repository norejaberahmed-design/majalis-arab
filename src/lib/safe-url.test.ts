import { describe, expect, it } from "vitest";
import { safeExternalHttpUrl } from "./safe-url";

describe("safeExternalHttpUrl", () => {
  it("allows valid HTTP and HTTPS links", () => {
    expect(safeExternalHttpUrl("https://example.com/book")).toBe("https://example.com/book");
    expect(safeExternalHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects script schemes, malformed URLs, and credential-bearing URLs", () => {
    expect(safeExternalHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalHttpUrl("not a url")).toBeNull();
    expect(safeExternalHttpUrl("https://user:pass@example.com")).toBeNull();
  });

  it("rejects missing links", () => {
    expect(safeExternalHttpUrl(null)).toBeNull();
    expect(safeExternalHttpUrl("")).toBeNull();
  });
});
