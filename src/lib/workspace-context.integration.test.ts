import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  workspaceId: null as string | null,
  cookies: vi.fn(async () => ({
    get: (name: string) => name === "majalis_workspace" && mocks.workspaceId
      ? { value: mocks.workspaceId }
      : undefined
  }))
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } }
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies
}));

import { prisma } from "@/lib/prisma";
import { getWorkspaceContext } from "@/lib/workspace";

const suffix = `workspace-context-${crypto.randomUUID()}`;
let userA: { id: string; email: string };
let userB: { id: string; email: string };
let workspaceA: { id: string };
let workspaceB: { id: string };

describe("workspace context enforces server-side membership", () => {
  beforeAll(async () => {
    userA = await prisma.user.create({
      data: { name: "Context user A", email: `${suffix}-a@example.test` },
      select: { id: true, email: true }
    });
    userB = await prisma.user.create({
      data: { name: "Context user B", email: `${suffix}-b@example.test` },
      select: { id: true, email: true }
    });
    workspaceA = await prisma.workspace.create({
      data: { name: "Context workspace A", slug: `${suffix}-a` },
      select: { id: true }
    });
    workspaceB = await prisma.workspace.create({
      data: { name: "Context workspace B", slug: `${suffix}-b` },
      select: { id: true }
    });
    await prisma.workspaceMember.create({
      data: { workspaceId: workspaceA.id, userId: userA.id, role: "OWNER" }
    });
    await prisma.workspaceMember.create({
      data: { workspaceId: workspaceB.id, userId: userB.id, role: "OWNER" }
    });
  });

  beforeEach(() => {
    mocks.workspaceId = workspaceA.id;
    mocks.getSession.mockResolvedValue({ user: { id: userA.id, email: userA.email } });
  });

  afterAll(async () => {
    if (workspaceA?.id) await prisma.workspace.deleteMany({ where: { id: workspaceA.id } });
    if (workspaceB?.id) await prisma.workspace.deleteMany({ where: { id: workspaceB.id } });
    if (userA?.id) await prisma.user.deleteMany({ where: { id: userA.id } });
    if (userB?.id) await prisma.user.deleteMany({ where: { id: userB.id } });
    await prisma.$disconnect();
  });

  it("resolves the workspace only when the signed-in user is a member", async () => {
    const context = await getWorkspaceContext(new Headers());
    expect(context?.user.id).toBe(userA.id);
    expect(context?.workspaceId).toBe(workspaceA.id);
    expect(context?.role).toBe("OWNER");
  });

  it("rejects a forged active-workspace cookie for a workspace the user does not belong to", async () => {
    mocks.workspaceId = workspaceB.id;
    const context = await getWorkspaceContext(new Headers());
    expect(context).toBeNull();
  });

  it("rejects a missing active-workspace cookie", async () => {
    mocks.workspaceId = null;
    const context = await getWorkspaceContext(new Headers());
    expect(context).toBeNull();
  });

  it("rejects an unauthenticated request even when a workspace cookie is present", async () => {
    mocks.getSession.mockResolvedValue(null);
    const context = await getWorkspaceContext(new Headers());
    expect(context).toBeNull();
  });
});
