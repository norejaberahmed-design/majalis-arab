import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  entityFindUnique: vi.fn(),
  claimFindUnique: vi.fn(),
  relationshipFindFirst: vi.fn(),
  relationshipCreate: vi.fn(),
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

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://majalis.example/api/curation/relationships", {
    method: "POST",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
const validBody = {
  fromEntityId: "entity-a",
  toEntityId: "entity-b",
  relationshipType: "BRANCH_OF",
  claimId: "claim-a",
  description: "تسجل هذه العلاقة وفق الادعاء المراجع المرتبط بالمصدر"
};

describe("evidence-linked relationship creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.isCatalogueCurator.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "curator-a", email: "curator@example.test" }, role: "REVIEWER" });
    mocks.entityFindUnique.mockResolvedValue({ id: "entity-a", name: "Entity A" });
    mocks.claimFindUnique.mockResolvedValue({ id: "claim-a", entityId: "entity-a", status: "SUPPORTED", reviewedByHuman: true, statement: "Claim", supportingPassages: [{ id: "passage-a" }] });
    mocks.relationshipFindFirst.mockResolvedValue(null);
    mocks.relationshipCreate.mockResolvedValue({ id: "relationship-a", relationshipType: "BRANCH_OF", description: validBody.description, claimId: "claim-a", createdAt: new Date() });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      tribalEntity: { findUnique: mocks.entityFindUnique },
      historicalClaim: { findUnique: mocks.claimFindUnique },
      relationship: { findFirst: mocks.relationshipFindFirst, create: mocks.relationshipCreate },
      auditLog: { create: mocks.auditCreate }
    }));
    mocks.entityFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, name: where.id }));
  });

  it("rejects untrusted origin before workspace lookup", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request(validBody));
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("rejects self relationships", async () => {
    const response = await POST(request({ ...validBody, toEntityId: "entity-a" }));
    expect(response.status).toBe(422);
    expect(mocks.relationshipCreate).not.toHaveBeenCalled();
  });

  it("rejects claims that are not human-reviewed and supported", async () => {
    mocks.claimFindUnique.mockResolvedValue({ id: "claim-a", entityId: "entity-a", status: "UNREVIEWED", reviewedByHuman: false, supportingPassages: [] });
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    expect(mocks.relationshipCreate).not.toHaveBeenCalled();
  });

  it("creates a relationship only when linked to a reviewed supported claim", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(201);
    expect(mocks.relationshipCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fromEntityId: "entity-a", toEntityId: "entity-b", claimId: "claim-a" })
    }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });
});
