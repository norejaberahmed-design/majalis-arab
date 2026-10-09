import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  sourceFindUnique: vi.fn(),
  entityFindUnique: vi.fn(),
  passageCreate: vi.fn(),
  auditCreate: vi.fn(),
  suggestionUpsert: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));
vi.mock("@/lib/source-intake", () => ({ isCatalogueCurator: mocks.isCatalogueCurator }));
vi.mock("@/lib/evidence-extraction", () => ({ extractEvidenceDrafts: vi.fn(async () => []) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    source: { findUnique: mocks.sourceFindUnique },
    tribalEntity: { findUnique: mocks.entityFindUnique },
    evidencePassage: { create: mocks.passageCreate },
    auditLog: { create: mocks.auditCreate },
    researchSuggestion: { upsert: mocks.suggestionUpsert },
    $transaction: mocks.transaction
  }
}));

import { POST } from "./route";

function request() {
  return new NextRequest("https://majalis.example/api/sources/source-a/passages", {
    method: "POST",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify({ pageLabel: "ص 10", passageText: "هذا نص مقتبس طويل بما يكفي لاختبار تسجيل مقطع دليل تاريخي." })
  });
}

describe("evidence passage creation authorization", () => {
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
    mocks.entityFindUnique.mockResolvedValue({ id: "entity-a" });
    mocks.passageCreate.mockResolvedValue({ id: "passage-a" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.suggestionUpsert.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      evidencePassage: { create: mocks.passageCreate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("rejects requests from an untrusted origin before reading identity or writing", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request(), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
    expect(mocks.passageCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests without writing catalogue data", async () => {
    mocks.getWorkspaceContext.mockResolvedValue(null);
    const response = await POST(request(), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(401);
    expect(mocks.sourceFindUnique).not.toHaveBeenCalled();
    expect(mocks.passageCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects a user without reviewer role even if their email is allowlisted", async () => {
    mocks.roleAtLeast.mockReturnValue(false);
    const response = await POST(request(), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.sourceFindUnique).not.toHaveBeenCalled();
    expect(mocks.passageCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects a reviewer who is not on the server-side curator allowlist", async () => {
    mocks.isCatalogueCurator.mockReturnValue(false);
    const response = await POST(request(), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.sourceFindUnique).not.toHaveBeenCalled();
    expect(mocks.passageCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
