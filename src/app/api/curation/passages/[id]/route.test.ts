import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));
vi.mock("@/lib/workspace", () => ({ getWorkspaceContext: mocks.getWorkspaceContext, hasTrustedOrigin: mocks.hasTrustedOrigin, roleAtLeast: mocks.roleAtLeast }));
vi.mock("@/lib/source-intake", () => ({ isCatalogueCurator: mocks.isCatalogueCurator }));
vi.mock("@/lib/prisma", () => ({ prisma: { evidencePassage: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow }, auditLog: { create: mocks.auditCreate }, $transaction: mocks.transaction } }));
import { PATCH } from "./route";

describe("catalogue passage review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "curator-a", email: "curator@example.test" }, role: "REVIEWER" });
    mocks.findUnique.mockResolvedValue({ id: "passage-a", sourceId: "source-a", reviewedByHuman: false, source: { humanReviewed: true, accessStatus: "OPEN_ACCESS" } });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "passage-a", sourceId: "source-a", pageLabel: "p. 10", locator: null, reviewedByHuman: true, reviewNote: "Matched against the cited scan." });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({ evidencePassage: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow }, auditLog: { create: mocks.auditCreate } }));
  });
  it("does not mark a passage reviewed before its source is reviewed", async () => {
    mocks.findUnique.mockResolvedValue({ id: "passage-a", sourceId: "source-a", reviewedByHuman: false, source: { humanReviewed: false, accessStatus: "NOT_CHECKED" } });
    const response = await PATCH(new NextRequest("https://majalis.example/api/curation/passages/passage-a", { method: "PATCH", headers: { origin: "https://majalis.example", "content-type": "application/json" }, body: JSON.stringify({ reviewNote: "Matched against the cited scan." }) }), { params: Promise.resolve({ id: "passage-a" }) });
    expect(response.status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("records a human review note and audit event", async () => {
    const response = await PATCH(new NextRequest("https://majalis.example/api/curation/passages/passage-a", { method: "PATCH", headers: { origin: "https://majalis.example", "content-type": "application/json" }, body: JSON.stringify({ reviewNote: "Matched against the cited scan." }) }), { params: Promise.resolve({ id: "passage-a" }) });
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "passage-a", reviewedByHuman: false }, data: { reviewedByHuman: true, reviewNote: "Matched against the cited scan." } }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });
});
