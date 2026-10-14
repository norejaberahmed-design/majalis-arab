import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true)
}));
vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin
}));

import { prisma } from "@/lib/prisma";
import { GET as listConversations, POST as startConversation } from "./route";
import { GET as listMessages, POST as sendMessage } from "./[id]/messages/route";

const suffix = `direct-message-test-${crypto.randomUUID()}`;
let userA: { id: string; email: string };
let userB: { id: string; email: string };
let userC: { id: string; email: string };
let userD: { id: string; email: string };
let workspaceA: { id: string };
let workspaceB: { id: string };
let foreignConversation: { id: string };
let ownConversation: { id: string };

describe("private messages authorization integration", () => {
  beforeAll(async () => {
    userA = await prisma.user.create({ data: { name: "Member A", email: `${suffix}-a@example.test` }, select: { id: true, email: true } });
    userB = await prisma.user.create({ data: { name: "Member B", email: `${suffix}-b@example.test` }, select: { id: true, email: true } });
    userC = await prisma.user.create({ data: { name: "Member C", email: `${suffix}-c@example.test` }, select: { id: true, email: true } });
    userD = await prisma.user.create({ data: { name: "Member D", email: `${suffix}-d@example.test` }, select: { id: true, email: true } });
    workspaceA = await prisma.workspace.create({ data: { name: "Direct messages A", slug: `${suffix}-a` }, select: { id: true } });
    workspaceB = await prisma.workspace.create({ data: { name: "Direct messages B", slug: `${suffix}-b` }, select: { id: true } });
    await prisma.workspaceMember.createMany({ data: [
      { workspaceId: workspaceA.id, userId: userA.id, role: "OWNER" },
      { workspaceId: workspaceA.id, userId: userD.id, role: "VIEWER" },
      { workspaceId: workspaceB.id, userId: userB.id, role: "OWNER" },
      { workspaceId: workspaceB.id, userId: userC.id, role: "VIEWER" }
    ] });
    foreignConversation = await prisma.directConversation.create({
      data: { workspaceId: workspaceB.id, participantAId: [userB.id, userC.id].sort()[0], participantBId: [userB.id, userC.id].sort()[1] },
      select: { id: true }
    });
    await prisma.directMessage.create({ data: { workspaceId: workspaceB.id, conversationId: foreignConversation.id, authorId: userB.id, content: "Private text from workspace B" } });
    ownConversation = await prisma.directConversation.create({
      data: { workspaceId: workspaceA.id, participantAId: [userA.id, userD.id].sort()[0], participantBId: [userA.id, userD.id].sort()[1] },
      select: { id: true }
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: workspaceA.id, user: { id: userA.id, email: userA.email }, role: "OWNER" });
  });

  afterAll(async () => {
    if (workspaceA?.id) await prisma.workspace.deleteMany({ where: { id: workspaceA.id } });
    if (workspaceB?.id) await prisma.workspace.deleteMany({ where: { id: workspaceB.id } });
    for (const user of [userA, userB, userC, userD]) if (user?.id) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it("does not list conversations or messages from another workspace", async () => {
    const response = await listConversations(new NextRequest("https://majalis.example/api/messages"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.some((item: { id: string }) => item.id === foreignConversation.id)).toBe(false);
    expect(body.members.some((item: { id: string }) => item.id === userB.id)).toBe(false);
  });

  it("denies reading a guessed conversation ID from another workspace", async () => {
    const response = await listMessages(new NextRequest(`https://majalis.example/api/messages/${foreignConversation.id}/messages`), { params: Promise.resolve({ id: foreignConversation.id }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it("cannot start a conversation with a non-member of the active workspace", async () => {
    const response = await startConversation(new NextRequest("https://majalis.example/api/messages", {
      method: "POST", headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ participantUserId: userB.id })
    }));
    expect(response.status).toBe(404);
    expect(await prisma.directConversation.count({ where: { workspaceId: workspaceA.id, OR: [{ participantAId: userA.id, participantBId: userB.id }, { participantAId: userB.id, participantBId: userA.id }] } })).toBe(0);
  });

  it("rejects a write from an untrusted origin before creating data", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const before = await prisma.directMessage.count({ where: { conversationId: ownConversation.id } });
    const response = await sendMessage(new NextRequest(`https://majalis.example/api/messages/${ownConversation.id}/messages`, {
      method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ content: "Should not persist" })
    }), { params: Promise.resolve({ id: ownConversation.id }) });
    expect(response.status).toBe(403);
    expect(await prisma.directMessage.count({ where: { conversationId: ownConversation.id } })).toBe(before);
  });

  it("rejects overlong message content without persisting it", async () => {
    const response = await sendMessage(new NextRequest(`https://majalis.example/api/messages/${ownConversation.id}/messages`, {
      method: "POST", headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(4001) })
    }), { params: Promise.resolve({ id: ownConversation.id }) });
    expect(response.status).toBe(400);
    expect(await prisma.directMessage.count({ where: { conversationId: ownConversation.id } })).toBe(0);
  });

  it("revokes conversation access when the other participant is removed from the workspace", async () => {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: workspaceA.id, userId: userD.id } });
    try {
      const response = await listMessages(new NextRequest(`https://majalis.example/api/messages/${ownConversation.id}/messages`), { params: Promise.resolve({ id: ownConversation.id }) });
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: expect.any(String) });
    } finally {
      await prisma.workspaceMember.create({ data: { workspaceId: workspaceA.id, userId: userD.id, role: "VIEWER" } });
    }
  });

  it("reuses the same one-to-one conversation instead of creating duplicates", async () => {
    const request = () => new NextRequest("https://majalis.example/api/messages", {
      method: "POST", headers: { origin: "https://majalis.example", "content-type": "application/json" },
      body: JSON.stringify({ participantUserId: userD.id })
    });
    const first = await startConversation(request());
    const second = await startConversation(request());
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await first.json()).data.id).toBe((await second.json()).data.id);
    expect(await prisma.directConversation.count({ where: { workspaceId: workspaceA.id, OR: [{ participantAId: userA.id, participantBId: userD.id }, { participantAId: userD.id, participantBId: userA.id }] } })).toBe(1);
  });
});
