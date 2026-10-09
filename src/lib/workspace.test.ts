import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  cookieGet: vi.fn(),
  findMembership: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet }))
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } }
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { workspaceMember: { findUnique: mocks.findMembership } }
}));

import { getWorkspaceContext } from "./workspace";

describe("workspace context role validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user-1", email: "user@example.test" } });
    mocks.cookieGet.mockReturnValue({ value: "workspace-1" });
    mocks.findMembership.mockResolvedValue({
      workspaceId: "workspace-1",
      role: "VIEWER",
      workspace: { id: "workspace-1", name: "Test" }
    });
  });

  it("returns a context for a recognized role", async () => {
    const context = await getWorkspaceContext(new Headers());
    expect(context?.role).toBe("VIEWER");
  });

  it.each(["ADMIN", "OWNER; DROP TABLE WorkspaceMember", "", null])(
    "rejects an unknown stored role (%s)",
    async role => {
      mocks.findMembership.mockResolvedValue({
        workspaceId: "workspace-1",
        role,
        workspace: { id: "workspace-1", name: "Test" }
      });
      await expect(getWorkspaceContext(new Headers())).resolves.toBeNull();
    }
  );

  it("does not query membership when there is no authenticated session", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getWorkspaceContext(new Headers())).resolves.toBeNull();
    expect(mocks.findMembership).not.toHaveBeenCalled();
  });
});
