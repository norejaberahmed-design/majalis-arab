import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  sourceSafeParse: vi.fn((value: unknown) => ({ success: true, data: value })),
  sourceFindFirst: vi.fn(),
  sourceCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));
vi.mock("@/lib/source-intake", () => ({
  isCatalogueCurator: mocks.isCatalogueCurator,
  sourceInputSchema: { safeParse: mocks.sourceSafeParse }
}));
vi.mock("@/lib/safe-url", () => ({ safeExternalHttpUrl: (url: string) => url.startsWith("https://") ? url : null }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://majalis.example/api/sources/import", {
    method: "POST",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
const sourceA = { title: "كتاب تاريخي أ", author: "مؤلف", publisher: "ناشر", publicationYear: 1950, edition: "الطبعة الثانية", url: "https://example.test/book", bibliographicNote: "" };

describe("bulk source import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.isCatalogueCurator.mockReturnValue(true);
    mocks.sourceSafeParse.mockImplementation((value: unknown) => ({ success: true, data: value }));
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "curator-a", email: "curator@example.test" }, role: "REVIEWER" });
    mocks.sourceFindFirst.mockResolvedValue(null);
    mocks.sourceCreate.mockImplementation(async ({ data }: { data: { title: string } }) => ({ id: "source-" + data.title, title: data.title }));
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      source: { findFirst: mocks.sourceFindFirst, create: mocks.sourceCreate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("rejects untrusted origin before workspace lookup", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request({ sources: [sourceA] }));
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("limits a request to at most 100 sources", async () => {
    const response = await POST(request({ sources: Array.from({ length: 101 }, (_, i) => ({ ...sourceA, title: "Book " + i })) }));
    expect(response.status).toBe(400);
    expect(mocks.sourceCreate).not.toHaveBeenCalled();
  });

  it("skips exact bibliographic duplicates and imports the rest as unreviewed", async () => {
    mocks.sourceFindFirst.mockImplementation(async ({ where }: { where: { title: string } }) => where.title === "كتاب تاريخي أ" ? { id: "existing" } : null);
    const response = await POST(request({ sources: [sourceA, { ...sourceA, title: "كتاب تاريخي ب" }] }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.createdCount).toBe(1);
    expect(body.data.duplicateCount).toBe(1);
    expect(mocks.sourceCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: "كتاب تاريخي ب", accessStatus: "NOT_CHECKED", humanReviewed: false })
    }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });
});
