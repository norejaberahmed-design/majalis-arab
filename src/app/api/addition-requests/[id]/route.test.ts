import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));
vi.mock("@/lib/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http")>("@/lib/http");
  return actual;
});
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction }
}));

import { PATCH } from "./route";

const reviewer = {
  workspaceId: "workspace-a",
  user: { id: "reviewer-a", email: "reviewer@example.test" },
  role: "REVIEWER"
};
const params = { params: Promise.resolve({ id: "request-a" }) };

function request(body: unknown, origin = "https://majalis.example") {
  return new NextRequest("https://majalis.example/api/addition-requests/request-a", {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("addition request review authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue(reviewer);
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.roleAtLeast.mockImplementation((role: string, minimum: string) =>
      minimum === "REVIEWER" && ["REVIEWER", "EDITOR", "OWNER"].includes(role)
    );
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findFirst.mockResolvedValue({
      id: "request-a",
      proposedName: "قبيلة تجريبية",
      status: "APPROVED",
      reviewerNote: "تمت مراجعة الطلب"
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit-a" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        additionRequest: { updateMany: mocks.updateMany, findFirst: mocks.findFirst },
        auditLog: { create: mocks.auditCreate }
      })
    );
  });

  it("rejects untrusted origins before resolving workspace or writing", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await PATCH(request({ status: "APPROVED" }, "https://attacker.example"), params);
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires a workspace session", async () => {
    mocks.getWorkspaceContext.mockResolvedValue(null);
    const response = await PATCH(request({ status: "APPROVED" }), params);
    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("denies members without reviewer role before accessing the request", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ ...reviewer, role: "VIEWER" });
    mocks.roleAtLeast.mockReturnValue(false);
    const response = await PATCH(request({ status: "APPROVED" }), params);
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported review states without writes", async () => {
    const response = await PATCH(request({ status: "PUBLISHED" }), params);
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("uses compare-and-set predicates scoped to the active workspace and audits successful review", async () => {
    const response = await PATCH(request({ status: "APPROVED", reviewerNote: "تمت مراجعة الطلب" }), params);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "request-a",
        workspaceId: "workspace-a",
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] }
      },
      data: { status: "APPROVED", reviewerNote: "تمت مراجعة الطلب" }
    });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "request-a", workspaceId: "workspace-a" }
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-a",
        actorUserId: "reviewer-a",
        action: "ADDITION_REQUEST_REVIEWED",
        targetId: "request-a"
      })
    }));
    expect(body.data.status).toBe("APPROVED");
  });

  it("does not audit or expose a guessed foreign-workspace request", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const response = await PATCH(request({ status: "APPROVED" }), {
      params: Promise.resolve({ id: "foreign-request" })
    });
    expect(response.status).toBe(404);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not write an audit event when the scoped request disappears after update", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const response = await PATCH(request({ status: "UNDER_REVIEW" }), params);
    expect(response.status).toBe(404);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
