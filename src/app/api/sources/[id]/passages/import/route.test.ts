import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  sourceFindUnique: vi.fn(),
  passageFindFirst: vi.fn(),
  passageCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));
vi.mock("@/lib/source-intake", () => ({ isCatalogueCurator: mocks.isCatalogueCurator }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    source: { findUnique: mocks.sourceFindUnique },
    $transaction: mocks.transaction
  }
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://majalis.example/api/sources/source-a/passages/import", {
    method: "POST",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
const passage = { pageLabel: "ص 10", passageText: "هذا نص تاريخي منقول حرفيًا وطويل بما يكفي لاختبار الاستيراد." };

describe("bulk evidence passage import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.isCatalogueCurator.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue({
      workspaceId: "workspace-a",
      user: { id: "curator-a", email: "curator@example.test" },
      role: "REVIEWER"
    });
    mocks.sourceFindUnique.mockResolvedValue({ id: "source-a" });
    mocks.passageFindFirst.mockResolvedValue(null);
    mocks.passageCreate.mockImplementation(async ({ data }: { data: { pageLabel: string; passageText: string } }) => ({ id: "passage-a", ...data }));
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      evidencePassage: { findFirst: mocks.passageFindFirst, create: mocks.passageCreate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("rejects an untrusted origin before checking identity", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request({ passages: [passage] }), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("rejects anonymous requests without writes", async () => {
    mocks.getWorkspaceContext.mockResolvedValue(null);
    const response = await POST(request({ passages: [passage] }), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(401);
    expect(mocks.sourceFindUnique).not.toHaveBeenCalled();
  });

  it("rejects more than 50 passages before writes", async () => {
    const response = await POST(request({ passages: Array.from({ length: 51 }, () => passage) }), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(400);
    expect(mocks.passageCreate).not.toHaveBeenCalled();
  });

  it("imports valid passages, skips exact duplicates, and records them as unreviewed", async () => {
    mocks.passageFindFirst.mockImplementation(async ({ where }: { where: { pageLabel: string } }) => where.pageLabel === "ص 10" ? { id: "existing" } : null);
    const response = await POST(request({ passages: [passage, { ...passage, pageLabel: "ص 11" }] }), { params: Promise.resolve({ id: "source-a" }) });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.createdCount).toBe(1);
    expect(body.data.duplicateCount).toBe(1);
    expect(mocks.passageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sourceId: "source-a", reviewedByHuman: false })
    }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });

  it("rejects a malformed row atomically before any writes", async () => {
    const response = await POST(request({ passages: [passage, { pageLabel: "", passageText: "too short" }] }), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(400);
    expect(mocks.passageCreate).not.toHaveBeenCalled();
  });
});
