import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { readJsonBody } from "./http";

function request(body: string, contentType = "application/json") {
  return new NextRequest("http://localhost/api/entities", {
    method: "POST",
    headers: { "content-type": contentType },
    body
  });
}

describe("readJsonBody", () => {
  it("accepts valid JSON within the limit", async () => {
    const result = await readJsonBody(request('{"name":"اختبار"}'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ name: "اختبار" });
  });

  it("rejects invalid JSON", async () => {
    const result = await readJsonBody(request("{broken"));
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects non-JSON content types", async () => {
    const result = await readJsonBody(request("name=x", "application/x-www-form-urlencoded"));
    expect(result).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects payloads exceeding the byte limit", async () => {
    const result = await readJsonBody(request(JSON.stringify({ value: "x".repeat(200) })), 100);
    expect(result).toMatchObject({ ok: false, status: 413 });
  });
});
