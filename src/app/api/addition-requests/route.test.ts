import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(),
  findMany: vi.fn(),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    additionRequest: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
      findFirst: mocks.findFirst
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction
  }
}));

import { GET } from "./route";
import { PATCH } from "./[id]/route";

const viewer = {
  workspaceId: "workspace-a",
  user: { id: "user-a", email: "a@example.test" },
  role: "VIEWER"
};

describe("addition request workspace isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue(viewer);
    mocks.findMany.mockResolvedValue([]);
    mocks.roleAtLeast.mockImplementation((role: string, minimum: string) =>
      minimum === "REVIEWER" && ["OWNER", "EDITOR", "REVIEWER"].includes(role)
    );
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.findFirst.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        additionRequest: {
          updateMany: mocks.updateMany,
          findFirst: mocks.findFirst
        },
        auditLog: { create: mocks.auditCreate }
      })
    );
  });

  it("limits a member's request list to their own requests in the active workspace", async () => {
    const request = new NextRequest("https://majalis.example/api/addition-requests");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-a", userId: "user-a" }
    }));
  });

  it("limits reviewers to requests inside the active workspace", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ ...viewer, role: "REVIEWER" });
    const request = new NextRequest("https://majalis.example/api/addition-requests");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-a" }
    }));
  });

  it("does not review a guessed request ID from another workspace", async () => {
    const request = new NextRequest("https://majalis.example/api/addition-requests/foreign-id", {
      method: "PATCH",
      headers: {
        origin: "https://majalis.example",
        "content-type": "application/json"
      },
      body: JSON.stringify({ status: "APPROVED" })
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "foreign-id" }) });

    expect(response.status).toBe(404);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "foreign-id",
        workspaceId: "workspace-a",
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] }
      }
    }));
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
