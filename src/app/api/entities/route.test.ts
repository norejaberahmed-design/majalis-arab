import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  findMany: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true)
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { tribalEntity: { findMany: mocks.findMany } }
}));

import { GET } from "./route";

describe("entity search API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({
      workspaceId: "workspace-a",
      user: { id: "user-a", email: "reader@example.test" },
      role: "VIEWER"
    });
    mocks.findMany.mockResolvedValue([
      { id: "entity-a", name: "بني تميم", normalizedName: "بني تميم", kind: "TRIBE", summary: null, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z") }
    ]);
  });

  it("requires a workspace session", async () => {
    mocks.getWorkspaceContext.mockResolvedValue(null);
    const response = await GET(new NextRequest("https://majalis.example/api/entities?q=تميم"));
    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("returns database search results as JSON without caching", async () => {
    const response = await GET(new NextRequest("https://majalis.example/api/entities?q=تميم"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      count: 1,
      data: [{ id: "entity-a", name: "بني تميم", kind: "TRIBE" }]
    });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ name: { contains: "تميم" } }, { normalizedName: { contains: "تميم" } }] },
      take: 100
    }));
  });

  it("rejects overlong queries before querying the database", async () => {
    const response = await GET(new NextRequest(`https://majalis.example/api/entities?q=${"ا".repeat(101)}`));
    expect(response.status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
