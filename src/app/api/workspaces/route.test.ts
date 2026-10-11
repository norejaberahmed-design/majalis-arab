import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  workspaceMemberFindMany: vi.fn(),
  workspaceCreate: vi.fn(),
  workspaceMemberCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } }
}));
vi.mock("@/lib/workspace", () => ({
  ACTIVE_WORKSPACE_COOKIE: "majalis_workspace",
  hasTrustedOrigin: mocks.hasTrustedOrigin
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: { findMany: mocks.workspaceMemberFindMany },
    $transaction: mocks.transaction
  }
}));

import { GET, POST } from "./route";

const session = { user: { id: "user-a", email: "owner@example.test" } };

describe("workspace collection authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(session);
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.workspaceMemberFindMany.mockResolvedValue([
      { role: "OWNER", workspace: { id: "workspace-a", name: "مجلس أ", slug: "majlis-a" } }
    ]);
    mocks.workspaceCreate.mockResolvedValue({
      id: "workspace-new",
      name: "مجلس جديد",
      slug: "majlis-jadid"
    });
    mocks.workspaceMemberCreate.mockResolvedValue({ id: "membership-new" });
    mocks.auditCreate.mockResolvedValue({ id: "audit-new" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        workspace: { create: mocks.workspaceCreate },
        workspaceMember: { create: mocks.workspaceMemberCreate },
        auditLog: { create: mocks.auditCreate }
      })
    );
  });

  it("requires a session before listing workspaces", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await GET(new NextRequest("https://majalis.example/api/workspaces"));
    expect(response.status).toBe(401);
    expect(mocks.workspaceMemberFindMany).not.toHaveBeenCalled();
  });

  it("lists only memberships belonging to the authenticated user", async () => {
    const response = await GET(new NextRequest("https://majalis.example/api/workspaces"));
    expect(response.status).toBe(200);
    expect(mocks.workspaceMemberFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-a" }
    }));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects cross-origin workspace creation before session or database access", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ name: "مجلس جديد" })
    }));
    expect(response.status).toBe(403);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires a session before creating a workspace", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ name: "مجلس جديد" })
    }));
    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed workspace names without writing records", async () => {
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ name: "x" })
    }));
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates the workspace, owner membership, and audit event atomically for the session user", async () => {
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ name: "  مجلس   جديد  " })
    }));
    expect(response.status).toBe(201);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.workspaceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "مجلس جديد" })
    });
    expect(mocks.workspaceMemberCreate).toHaveBeenCalledWith({
      data: { workspaceId: "workspace-new", userId: "user-a", role: "OWNER" }
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-new",
        actorUserId: "user-a",
        action: "WORKSPACE_CREATED",
        targetType: "Workspace",
        targetId: "workspace-new"
      })
    });
    expect(response.headers.get("set-cookie")).toContain("majalis_workspace=workspace-new");
  });
});
