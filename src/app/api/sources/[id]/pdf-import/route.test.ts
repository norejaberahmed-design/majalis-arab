import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  sourceFindUnique: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));
vi.mock("@/lib/source-intake", () => ({ isCatalogueCurator: mocks.isCatalogueCurator }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    source: { findUnique: mocks.sourceFindUnique, update: vi.fn() },
    $transaction: vi.fn()
  }
}));

import { POST } from "./route";

const reviewer = {
  workspaceId: "workspace-a",
  user: { id: "reviewer-a", email: "curator@example.test" },
  role: "REVIEWER"
};
function request(body?: FormData) {
  return new NextRequest("https://majalis.example/api/sources/source-a/pdf-import", {
    method: "POST",
    headers: { origin: "https://majalis.example" },
    body
  });
}

describe("PDF genealogy import authorization and validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue(reviewer);
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.isCatalogueCurator.mockReturnValue(true);
    mocks.sourceFindUnique.mockResolvedValue({ id: "source-a", title: "كتاب اختبار", author: null, edition: null, url: null });
  });

  it("rejects untrusted origins before checking workspace", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request(), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("rejects a user who is not an approved catalogue curator", async () => {
    mocks.isCatalogueCurator.mockReturnValue(false);
    const response = await POST(request(), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.sourceFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing file before invoking the extractor", async () => {
    const response = await POST(request(new FormData()), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("PDF");
  });

  it("returns not found for a missing source", async () => {
    mocks.sourceFindUnique.mockResolvedValue(null);
    const response = await POST(request(new FormData()), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });
});
