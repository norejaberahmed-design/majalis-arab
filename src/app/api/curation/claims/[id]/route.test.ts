import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  claimFindUnique: vi.fn(),
  claimUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));
vi.mock("@/lib/source-intake", () => ({ isCatalogueCurator: mocks.isCatalogueCurator }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { PATCH } from "./route";

function request(body: unknown) {
  return new NextRequest("https://majalis.example/api/curation/claims/claim-a", {
    method: "PATCH",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
const validReview = { status: "SUPPORTED", reviewerNote: "تمت مطابقة الادعاء مع النص ومراجعة سياقه" };

describe("historical claim human review", () => {
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
    mocks.claimFindUnique.mockResolvedValue({
      id: "claim-a", status: "UNREVIEWED",
      supportingPassages: [{ id: "passage-a" }], contradictingPassages: []
    });
    mocks.claimUpdate.mockResolvedValue({
      id: "claim-a", status: "SUPPORTED", reviewedByHuman: true, reviewedAt: new Date(), reviewerNote: validReview.reviewerNote
    });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      historicalClaim: { findUnique: mocks.claimFindUnique, update: mocks.claimUpdate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("rejects an untrusted origin before workspace lookup", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await PATCH(request(validReview), { params: Promise.resolve({ id: "claim-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("rejects non-curators without changing the claim", async () => {
    mocks.isCatalogueCurator.mockReturnValue(false);
    const response = await PATCH(request(validReview), { params: Promise.resolve({ id: "claim-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.claimUpdate).not.toHaveBeenCalled();
  });

  it("does not allow a supported status without reviewed supporting evidence", async () => {
    mocks.claimFindUnique.mockResolvedValue({ id: "claim-a", status: "UNREVIEWED", supportingPassages: [], contradictingPassages: [] });
    const response = await PATCH(request(validReview), { params: Promise.resolve({ id: "claim-a" }) });
    expect(response.status).toBe(409);
    expect(mocks.claimUpdate).not.toHaveBeenCalled();
  });

  it("does not allow disputed status without reviewed contradicting evidence", async () => {
    mocks.claimFindUnique.mockResolvedValue({ id: "claim-a", status: "UNREVIEWED", supportingPassages: [{ id: "passage-a" }], contradictingPassages: [] });
    const response = await PATCH(request({ status: "DISPUTED", reviewerNote: "يوجد تعارض في المصدر حسب المراجعة" }), { params: Promise.resolve({ id: "claim-a" }) });
    expect(response.status).toBe(409);
    expect(mocks.claimUpdate).not.toHaveBeenCalled();
  });

  it("saves a human decision and audit record", async () => {
    const response = await PATCH(request(validReview), { params: Promise.resolve({ id: "claim-a" }) });
    expect(response.status).toBe(200);
    expect(mocks.claimUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "claim-a" },
      data: expect.objectContaining({ status: "SUPPORTED", reviewedByHuman: true, reviewerNote: validReview.reviewerNote })
    }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });
});
