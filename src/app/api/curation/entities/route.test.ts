import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  passageFindUnique: vi.fn(),
  entityFindUnique: vi.fn(),
  entityCreate: vi.fn(),
  passageUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));
vi.mock("@/lib/workspace", () => ({ getWorkspaceContext: mocks.getWorkspaceContext, hasTrustedOrigin: mocks.hasTrustedOrigin, roleAtLeast: mocks.roleAtLeast }));
vi.mock("@/lib/source-intake", () => ({ isCatalogueCurator: mocks.isCatalogueCurator }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { POST } from "./route";

describe("curated entity creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "curator-a", email: "curator@example.test" }, role: "REVIEWER" });
    mocks.passageFindUnique.mockResolvedValue({ id: "passage-a", passageText: "ورد في النص: قبيلة بني تميم كانت في المنطقة.", entityId: null, reviewedByHuman: true, source: { id: "source-a", title: "Source", humanReviewed: true, accessStatus: "OPEN_ACCESS" } });
    mocks.entityFindUnique.mockResolvedValue(null);
    mocks.entityCreate.mockResolvedValue({ id: "entity-a", name: "بني تميم", kind: "TRIBE", summary: null, createdAt: new Date() });
    mocks.passageUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      evidencePassage: { findUnique: mocks.passageFindUnique, updateMany: mocks.passageUpdateMany },
      tribalEntity: { findUnique: mocks.entityFindUnique, create: mocks.entityCreate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  function request(name: string) {
    return new NextRequest("https://majalis.example/api/curation/entities", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ name, kind: "TRIBE", passageId: "passage-a" })
    });
  }

  it("creates a name only when it appears in a reviewed passage and links the evidence", async () => {
    const response = await POST(request("بني تميم"));
    expect(response.status).toBe(201);
    expect(mocks.entityCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: "بني تميم", normalizedName: "بني تميم", kind: "TRIBE", summary: null }
    }));
    expect(mocks.passageUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "passage-a", entityId: null, reviewedByHuman: true },
      data: { entityId: "entity-a" }
    }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });

  it("rejects names not present as a phrase in the reviewed source passage", async () => {
    const response = await POST(request("قبيلة مختلقة"));
    expect(response.status).toBe(422);
    expect(mocks.entityCreate).not.toHaveBeenCalled();
  });

  it("rejects passages or sources that have not been reviewed", async () => {
    mocks.passageFindUnique.mockResolvedValue({ id: "passage-a", passageText: "قبيلة بني تميم", entityId: null, reviewedByHuman: false, source: { id: "source-a", title: "Source", humanReviewed: true, accessStatus: "OPEN_ACCESS" } });
    const response = await POST(request("بني تميم"));
    expect(response.status).toBe(409);
    expect(mocks.entityCreate).not.toHaveBeenCalled();
  });
  
  it("rejects an untrusted origin before resolving the workspace or opening a transaction", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request("بني تميم"));
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.entityCreate).not.toHaveBeenCalled();
  });

  it("denies a reviewer who is not on the catalogue curator allowlist", async () => {
    mocks.isCatalogueCurator.mockReturnValue(false);
    const response = await POST(request("بني تميم"));
    expect(response.status).toBe(403);
    expect(mocks.isCatalogueCurator).toHaveBeenCalledWith("curator@example.test", process.env.CATALOGUE_CURATOR_EMAILS);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.entityCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("denies a user without reviewer-level workspace permissions even if allowlisted", async () => {
    mocks.roleAtLeast.mockReturnValue(false);
    const response = await POST(request("بني تميم"));
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.entityCreate).not.toHaveBeenCalled();
  });

});
