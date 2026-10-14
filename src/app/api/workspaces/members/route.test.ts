import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(),
  memberFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  memberFindUnique: vi.fn(),
  memberCreate: vi.fn(),
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
    workspaceMember: {
      findMany: mocks.memberFindMany,
      findUnique: mocks.memberFindUnique
    },
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction
  }
}));

import { GET, POST } from "./route";

const owner = {
  workspaceId: "workspace-a",
  workspace: { id: "workspace-a", name: "مجلس الاختبار" },
  user: { id: "owner-a", email: "owner@example.test" },
  role: "OWNER"
};

describe("workspace member access boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue(owner);
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.memberFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({
      id: "member-b",
      name: "Member B",
      email: "member@example.test",
      image: null
    });
    mocks.memberFindUnique.mockResolvedValue(null);
    mocks.memberCreate.mockResolvedValue({
      id: "membership-b",
      role: "VIEWER",
      createdAt: new Date("2026-01-01T00:00:00.000Z")
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit-b" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        workspaceMember: { create: mocks.memberCreate },
        auditLog: { create: mocks.auditCreate }
      })
    );
  });

  it("lists members only from the active workspace", async () => {
    const response = await GET(new NextRequest("https://majalis.example/api/workspaces/members"));

    expect(response.status).toBe(200);
    expect(mocks.memberFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-a" }
    }));
  });

  it("hides member email addresses from ordinary viewers", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ ...owner, role: "VIEWER" });
    mocks.roleAtLeast.mockReturnValue(false);
    mocks.memberFindMany.mockResolvedValue([{
      id: "membership-b",
      role: "VIEWER",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: { id: "member-b", name: "Member B", email: "private@example.test", image: null }
    }]);

    const response = await GET(new NextRequest("https://majalis.example/api/workspaces/members"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.members[0].user.email).toBe("");
    expect(JSON.stringify(body)).not.toContain("private@example.test");
  });

  it("allows roster managers to view member email addresses", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ ...owner, role: "EDITOR" });
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.memberFindMany.mockResolvedValue([{
      id: "membership-b",
      role: "VIEWER",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: { id: "member-b", name: "Member B", email: "member@example.test", image: null }
    }]);

    const response = await GET(new NextRequest("https://majalis.example/api/workspaces/members"));
    const body = await response.json();

    expect(body.data.members[0].user.email).toBe("member@example.test");
  });

  it("rejects member changes from an untrusted origin before querying workspace data", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/members", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ email: "member@example.test" })
    }));

    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
    expect(mocks.memberCreate).not.toHaveBeenCalled();
  });

  it("denies a viewer from adding members", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ ...owner, role: "VIEWER" });
    mocks.roleAtLeast.mockReturnValue(false);
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/members", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ email: "member@example.test" })
    }));

    expect(response.status).toBe(403);
    expect(mocks.memberCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("adds a new member as VIEWER and records the audit event in the active workspace", async () => {
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/members", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ email: " MEMBER@EXAMPLE.TEST " })
    }));

    expect(response.status).toBe(201);
    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: { workspaceId: "workspace-a", userId: "member-b", role: "VIEWER" },
      select: { id: true, role: true, createdAt: true }
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-a",
        actorUserId: "owner-a",
        action: "COUNCIL_MEMBER_ADDED",
        targetType: "WorkspaceMember"
      })
    }));
  });

  it("does not duplicate an existing membership", async () => {
    mocks.memberFindUnique.mockResolvedValue({ id: "membership-existing" });
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/members", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ email: "member@example.test" })
    }));

    expect(response.status).toBe(409);
    expect(mocks.memberCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
  
  it("returns a conflict when concurrent requests race on the membership unique constraint", async () => {
    mocks.memberCreate.mockRejectedValueOnce({ code: "P2002" });
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/members", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ email: "member@example.test" })
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "هذا الحساب عضو بالفعل في المجلس" });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("never accepts a client-supplied elevated role when adding a member", async () => {
    const response = await POST(new NextRequest("https://majalis.example/api/workspaces/members", {
      method: "POST",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ email: "member@example.test", role: "OWNER" })
    }));

    expect(response.status).toBe(201);
    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: { workspaceId: "workspace-a", userId: "member-b", role: "VIEWER" },
      select: { id: true, role: true, createdAt: true }
    });
  });

});
