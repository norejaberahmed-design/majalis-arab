import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ hasTrustedOrigin: vi.fn(() => true), getWorkspaceContext: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ hasTrustedOrigin: mocks.hasTrustedOrigin, getWorkspaceContext: mocks.getWorkspaceContext }));
vi.mock("@/lib/tribe-evidence", () => ({ buildTribeEvidenceContext: vi.fn(async () => undefined) }));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://majalis.example/api/assistant", {
    method: "POST",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("assistant API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "user-a" }, role: "VIEWER" });
  });

  it("rejects untrusted origins and unauthenticated requests", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    expect((await POST(request({ messages: [{ role: "user", content: "مرحبا" }] }))).status).toBe(403);
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue(null);
    expect((await POST(request({ messages: [{ role: "user", content: "مرحبا" }] }))).status).toBe(401);
  });

  it("validates message count and length", async () => {
    const response = await POST(request({ messages: [] }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("من رسالة");
  });

  it("returns a clear setup response when the API key is missing", async () => {
    const response = await POST(request({ messages: [{ role: "user", content: "لخص هذه الرواية" }] }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("OPENAI_API_KEY");
  });

  it("returns the provider answer without storing the conversation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: "هذه خلاصة تجريبية." }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ messages: [{ role: "user", content: "لخص هذه الرواية" }] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ answer: "هذه خلاصة تجريبية.", model: "gpt-4.1-mini" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.body).toContain('"store":false');
  });
});
