import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  process.env.DATABASE_URL ??= "file:./dev.db";
  return {
    getWorkspaceContext: vi.fn(),
    hasTrustedOrigin: vi.fn(() => true),
    roleAtLeast: vi.fn((role: string, minimum: string) => {
      const levels: Record<string, number> = { VIEWER: 0, REVIEWER: 1, EDITOR: 2, OWNER: 3 };
      return levels[role] !== undefined && levels[minimum] !== undefined && levels[role] >= levels[minimum];
    })
  };
});

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));

import { prisma } from "@/lib/prisma";
import { GET as listAdditionRequests } from "./route";
import { PATCH as reviewAdditionRequest } from "./[id]/route";
import { GET as getEntityNote } from "../entities/[id]/note/route";

const suffix = `tenant-test-${crypto.randomUUID()}`;
let userA: { id: string; email: string };
let userB: { id: string; email: string };
let workspaceA: { id: string; name: string };
let workspaceB: { id: string; name: string };
let entity: { id: string; name: string };
let foreignRequest: { id: string };

describe("SQLite tenant-isolation integration", () => {
  beforeAll(async () => {
    userA = await prisma.user.create({
      data: { name: "Tenant A", email: `${suffix}-a@example.test` },
      select: { id: true, email: true }
    });
    userB = await prisma.user.create({
      data: { name: "Tenant B", email: `${suffix}-b@example.test` },
      select: { id: true, email: true }
    });
    workspaceA = await prisma.workspace.create({
      data: { name: "Workspace A", slug: `${suffix}-a` },
      select: { id: true, name: true }
    });
    workspaceB = await prisma.workspace.create({
      data: { name: "Workspace B", slug: `${suffix}-b` },
      select: { id: true, name: true }
    });
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: workspaceA.id, userId: userA.id, role: "OWNER" },
        { workspaceId: workspaceB.id, userId: userB.id, role: "OWNER" }
      ]
    });
    entity = await prisma.tribalEntity.create({
      data: { name: `Integration test ${suffix}`, normalizedName: `integration-test-${crypto.randomUUID()}`, kind: "TRIBE" },
      select: { id: true, name: true }
    });
    foreignRequest = await prisma.additionRequest.create({
      data: {
        workspaceId: workspaceB.id,
        userId: userB.id,
        proposedName: `Foreign request ${suffix}`,
        explanation: "Cross-workspace access regression fixture",
        status: "SUBMITTED"
      },
      select: { id: true }
    });
    await prisma.workspaceEntityNote.create({
      data: {
        workspaceId: workspaceB.id,
        entityId: entity.id,
        userId: userB.id,
        note: "Secret note belonging to workspace B"
      }
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({
      workspaceId: workspaceA.id,
      user: { id: userA.id, email: userA.email },
      role: "VIEWER"
    });
  });

  afterAll(async () => {
    if (workspaceA?.id) await prisma.workspace.deleteMany({ where: { id: workspaceA.id } });
    if (workspaceB?.id) await prisma.workspace.deleteMany({ where: { id: workspaceB.id } });
    if (entity?.id) await prisma.tribalEntity.deleteMany({ where: { id: entity.id } });
    if (userA?.id) await prisma.user.deleteMany({ where: { id: userA.id } });
    if (userB?.id) await prisma.user.deleteMany({ where: { id: userB.id } });
    await prisma.$disconnect();
  });

  it("does not return another workspace's addition request", async () => {
    const request = new NextRequest("https://majalis.example/api/addition-requests");
    const response = await listAdditionRequests(request);
    const body = await response.json() as { data: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.data.some(item => item.id === foreignRequest.id)).toBe(false);
  });

  it("cannot change another workspace's request using a guessed ID", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({
      workspaceId: workspaceA.id,
      user: { id: userA.id, email: userA.email },
      role: "REVIEWER"
    });
    const request = new NextRequest(`https://majalis.example/api/addition-requests/${foreignRequest.id}`, {
      method: "PATCH",
      headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" })
    });
    const response = await reviewAdditionRequest(request, { params: Promise.resolve({ id: foreignRequest.id }) });
    const unchanged = await prisma.additionRequest.findUniqueOrThrow({
      where: { id: foreignRequest.id },
      select: { status: true }
    });
    const auditEvents = await prisma.auditLog.count({
      where: { workspaceId: workspaceA.id, targetId: foreignRequest.id }
    });

    expect(response.status).toBe(404);
    expect(unchanged.status).toBe("SUBMITTED");
    expect(auditEvents).toBe(0);
  });

  it("does not expose a private note from another workspace", async () => {
    const request = new NextRequest(`https://majalis.example/api/entities/${entity.id}/note`);
    const response = await getEntityNote(request, { params: Promise.resolve({ id: entity.id }) });
    const body = await response.json() as { data: { note: string } | null };

    expect(response.status).toBe(200);
    expect(body.data).toBeNull();
  });
});
