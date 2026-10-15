import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  hasTrustedOrigin: vi.fn(() => true),
  getWorkspaceContext: vi.fn(),
  findPost: vi.fn(),
  runMajalisAI: vi.fn(),
  buildTribeEvidenceContext: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({ hasTrustedOrigin: mocks.hasTrustedOrigin, getWorkspaceContext: mocks.getWorkspaceContext }));
vi.mock("@/lib/prisma", () => ({ prisma: { councilPost: { findFirst: mocks.findPost } } }));
vi.mock("@/lib/ai-engine", () => ({
  runMajalisAI: mocks.runMajalisAI,
  MajalisAIError: class MajalisAIError extends Error { constructor(message: string, public status: number) { super(message); } }
}));
vi.mock("@/lib/tribe-evidence", () => ({ buildTribeEvidenceContext: mocks.buildTribeEvidenceContext }));

import { POST } from "./route";

function request() {
  return new NextRequest("https://majalis.example/api/council/posts/post-a/analysis", {
    method: "POST",
    headers: { origin: "https://majalis.example" }
  });
}

describe("council post AI analysis API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "user-a" }, role: "VIEWER" });
    mocks.buildTribeEvidenceContext.mockResolvedValue("سياق مصادر تجريبي");
    mocks.runMajalisAI.mockResolvedValue({ answer: "ملخص النقاش", model: "test-model" });
  });

  it("rejects untrusted origins", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    expect((await POST(request(), { params: Promise.resolve({ id: "post-a" }) })).status).toBe(403);
  });

  it("does not analyze a post from another workspace", async () => {
    mocks.findPost.mockResolvedValue(null);
    expect((await POST(request(), { params: Promise.resolve({ id: "foreign-post" }) })).status).toBe(404);
    expect(mocks.runMajalisAI).not.toHaveBeenCalled();
  });

  it("analyzes only the post returned by the active-workspace-scoped query", async () => {
    mocks.findPost.mockResolvedValue({
      id: "post-a",
      content: "رواية تاريخية للنقاش",
      createdAt: new Date("2026-10-15T00:00:00Z"),
      comments: [{ content: "هل يوجد مصدر؟", createdAt: new Date("2026-10-15T00:01:00Z"), author: { name: "عضو" } }]
    });
    const response = await POST(request(), { params: Promise.resolve({ id: "post-a" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { answer: "ملخص النقاش", model: "test-model" } });
    expect(mocks.findPost).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post-a", workspaceId: "workspace-a" }
    }));
    expect(mocks.runMajalisAI).toHaveBeenCalledWith(expect.objectContaining({
      evidenceContext: "سياق مصادر تجريبي"
    }));
  });
});
