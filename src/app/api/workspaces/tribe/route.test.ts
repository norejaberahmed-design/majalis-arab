import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn((role: string, minimum: string) => minimum === "OWNER" && role === "OWNER"),
  linkFindUnique: vi.fn(),
  linkUpsert: vi.fn(),
  linkDelete: vi.fn(),
  entityFindUnique: vi.fn(),
  entityFindMany: vi.fn(),
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
    workspaceTribe: {
      findUnique: mocks.linkFindUnique,
      upsert: mocks.linkUpsert,
      delete: mocks.linkDelete
    },
    tribalEntity: {
      findUnique: mocks.entityFindUnique,
      findMany: mocks.entityFindMany
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction
  }
}));

import { DELETE, GET, POST } from "./route";

const owner = {
  workspaceId: "workspace-a",
  workspace: { id: "workspace-a", name: "مجلس الاختبار" },
  user: { id: "user-a", email: "owner@example.test" },
  role: "OWNER"
};

describe("tribal council link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue(owner);
    mocks.linkFindUnique.mockResolvedValue(null);
    mocks.linkUpsert.mockResolvedValue({ workspaceId: "workspace-a", entityId: "tribe-a", createdAt: new Date("2026-01-01T00:00:00Z") });
    mocks.entityFindUnique.mockResolvedValue({ id: "tribe-a", name: "قبيلة الاختبار", kind: "TRIBE" });
    mocks.entityFindMany.mockResolvedValue([]);
    mocks.linkDelete.mockResolvedValue({ workspaceId: "workspace-a" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      workspaceTribe: { upsert: mocks.linkUpsert, delete: mocks.linkDelete },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("lists only the active workspace's linked tribe and valid candidates", async () => {
    const request = new NextRequest("https://majalis.example/api/workspaces/tribe");
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(mocks.linkFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-a" }
    }));
    expect(mocks.entityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { kind: { in: ["TRIBE", "CLAN"] } }
    }));
  });

  it("rejects linking for a non-owner", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ ...owner, role: "EDITOR" });
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/tribe", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ entityId: "tribe-a" })
    }));
    expect(response.status).toBe(403);
    expect(mocks.linkUpsert).not.toHaveBeenCalled();
  });

  it("links only a real tribe/clan and records an audit event", async () => {
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/tribe", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ entityId: "tribe-a" })
    }));
    expect(response.status).toBe(200);
    expect(mocks.linkUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-a" },
      create: { workspaceId: "workspace-a", entityId: "tribe-a" }
    }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });

  it("does not link a person or place as a tribe", async () => {
    mocks.entityFindUnique.mockResolvedValue({ id: "person-a", name: "شخص", kind: "PERSON" });
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/tribe", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ entityId: "person-a" })
    }));
    expect(response.status).toBe(404);
    expect(mocks.linkUpsert).not.toHaveBeenCalled();
  });

  it("scopes unlinking and audit to the active workspace", async () => {
    mocks.linkFindUnique.mockResolvedValue({ entityId: "tribe-a" });
    const response = await DELETE(new NextRequest("https://majalis.example/api/workspaces/tribe", {
      method: "DELETE",
      headers: { origin: "https://majalis.example" }
    }));
    expect(response.status).toBe(200);
    expect(mocks.linkDelete).toHaveBeenCalledWith({ where: { workspaceId: "workspace-a" } });
    expect(mocks.auditCreate).toHaveBeenCalled();
  });
});
