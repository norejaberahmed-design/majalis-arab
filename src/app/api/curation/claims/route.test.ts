import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  sourceFindUnique: vi.fn(),
  passageFindMany: vi.fn(),
  entityFindUnique: vi.fn(),
  claimCreate: vi.fn(),
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
    $transaction: mocks.transaction
  }
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://majalis.example/api/curation/claims", {
    method: "POST",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
const validBody = {
  statement: "ادعاء تاريخي محدد مرتبط بالمصدر",
  sourceId: "source-a",
  entityId: "entity-a",
  supportingPassageIds: ["passage-a"],
  contradictingPassageIds: [],
  reviewerNote: "ملاحظة بحثية أولية"
};

describe("evidence-backed historical claim creation", () => {
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
    mocks.sourceFindUnique.mockResolvedValue({ id: "source-a", title: "Source", humanReviewed: true, accessStatus: "OPEN_ACCESS" });
    mocks.passageFindMany.mockResolvedValue([{ id: "passage-a", sourceId: "source-a", reviewedByHuman: true }]);
    mocks.entityFindUnique.mockResolvedValue({ id: "entity-a" });
    mocks.claimCreate.mockResolvedValue({ id: "claim-a", statement: validBody.statement, status: "UNREVIEWED", createdAt: new Date() });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      source: { findUnique: mocks.sourceFindUnique },
      evidencePassage: { findMany: mocks.passageFindMany },
      tribalEntity: { findUnique: mocks.entityFindUnique },
      historicalClaim: { create: mocks.claimCreate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("rejects an untrusted origin before reading the workspace", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request(validBody));
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("rejects users who are not authorized curators", async () => {
    mocks.isCatalogueCurator.mockReturnValue(false);
    const response = await POST(request(validBody));
    expect(response.status).toBe(403);
    expect(mocks.claimCreate).not.toHaveBeenCalled();
  });

  it("rejects claims without reviewed evidence", async () => {
    const response = await POST(request({ ...validBody, supportingPassageIds: [], contradictingPassageIds: [] }));
    expect(response.status).toBe(400);
    expect(mocks.claimCreate).not.toHaveBeenCalled();
  });

  it("refuses a passage that is not reviewed or belongs to another source", async () => {
    mocks.passageFindMany.mockResolvedValue([]);
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    expect(mocks.claimCreate).not.toHaveBeenCalled();
  });

  it("creates an unreviewed claim with supporting and contradicting evidence and an audit record", async () => {
    mocks.passageFindMany.mockResolvedValue([{ id: "passage-a", sourceId: "source-a", reviewedByHuman: true }, { id: "passage-b", sourceId: "source-a", reviewedByHuman: true }]);
    const response = await POST(request({ ...validBody, contradictingPassageIds: ["passage-b"] }));
    expect(response.status).toBe(201);
    expect(mocks.claimCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "UNREVIEWED",
        reviewedByHuman: false,
        supportingPassages: { connect: [{ id: "passage-a" }] },
        contradictingPassages: { connect: [{ id: "passage-b" }] }
      })
    }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });
});
