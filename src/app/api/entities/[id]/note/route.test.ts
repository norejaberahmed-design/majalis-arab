import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  findUnique: vi.fn(),
  entityFindUnique: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceEntityNote: { findUnique: mocks.findUnique },
    tribalEntity: { findUnique: mocks.entityFindUnique }
  }
}));

import { GET } from "./route";

describe("workspace entity note isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({
      workspaceId: "workspace-a",
      user: { id: "user-a", email: "a@example.test" },
      role: "VIEWER"
    });
    mocks.findUnique.mockResolvedValue(null);
  });

  it("queries a note using both the active workspace and entity ID", async () => {
    const request = new NextRequest("https://majalis.example/api/entities/entity-b/note");
    const response = await GET(request, { params: Promise.resolve({ id: "entity-b" }) });

    expect(response.status).toBe(200);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_entityId: {
          workspaceId: "workspace-a",
          entityId: "entity-b"
        }
      },
      select: {
        id: true,
        note: true,
        userId: true,
        createdAt: true,
        updatedAt: true
      }
    });
  });

  it("does not query private notes when the user has no active workspace membership", async () => {
    mocks.getWorkspaceContext.mockResolvedValue(null);
    const request = new NextRequest("https://majalis.example/api/entities/entity-b/note");
    const response = await GET(request, { params: Promise.resolve({ id: "entity-b" }) });

    expect(response.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
