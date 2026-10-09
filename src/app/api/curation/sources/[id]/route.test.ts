import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  findUnique: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));
vi.mock("@/lib/workspace", () => ({ getWorkspaceContext: mocks.getWorkspaceContext, hasTrustedOrigin: mocks.hasTrustedOrigin, roleAtLeast: mocks.roleAtLeast }));
vi.mock("@/lib/source-intake", () => ({ isCatalogueCurator: vi.fn(() => true) }));
vi.mock("@/lib/prisma", () => ({ prisma: { source: { findUnique: mocks.findUnique, update: mocks.update }, auditLog: { create: mocks.auditCreate }, $transaction: mocks.transaction } }));
import { PATCH } from "./route";

describe("catalogue source review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "curator-a", email: "curator@example.test" }, role: "REVIEWER" });
    mocks.findUnique.mockResolvedValue({ id: "source-a" });
    mocks.update.mockResolvedValue({ id: "source-a", title: "Source", accessStatus: "OPEN_ACCESS", accessCheckedAt: new Date(), extractionStatus: "EXTRACTED", humanReviewed: true });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({ source: { findUnique: mocks.findUnique, update: mocks.update }, auditLog: { create: mocks.auditCreate } }));
  });
  it("requires an authenticated trusted curator", async () => {
    mocks.roleAtLeast.mockReturnValue(false);
    const response = await PATCH(new NextRequest("https://majalis.example/api/curation/sources/source-a", { method: "PATCH", headers: { origin: "https://majalis.example", "content-type": "application/json" }, body: JSON.stringify({ accessStatus: "OPEN_ACCESS", extractionStatus: "EXTRACTED" }) }), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("records source review status and an audit event", async () => {
    const response = await PATCH(new NextRequest("https://majalis.example/api/curation/sources/source-a", { method: "PATCH", headers: { origin: "https://majalis.example", "content-type": "application/json" }, body: JSON.stringify({ accessStatus: "OPEN_ACCESS", extractionStatus: "EXTRACTED" }) }), { params: Promise.resolve({ id: "source-a" }) });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "source-a" }, data: expect.objectContaining({ accessStatus: "OPEN_ACCESS", humanReviewed: true }) }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });
});
