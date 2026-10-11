import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(),
  isCatalogueCurator: vi.fn(),
  safeExternalHttpUrl: vi.fn(),
  sourceCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));
vi.mock("@/lib/source-intake", () => ({
  isCatalogueCurator: mocks.isCatalogueCurator,
  sourceInputSchema: {
    safeParse: (value: unknown) => ({
      success: Boolean(value && typeof value === "object" && "title" in value && typeof (value as { title?: unknown }).title === "string" && (value as { title: string }).title.trim().length > 0),
      data: value
    })
  }
}));
vi.mock("@/lib/safe-url", () => ({
  safeExternalHttpUrl: mocks.safeExternalHttpUrl
}));
vi.mock("@/lib/http", () => ({
  readJsonBody: vi.fn(async (request: Request) => {
    try {
      return { ok: true, data: await request.json() };
    } catch {
      return { ok: false, status: 400, error: "invalid json" };
    }
  })
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

import { POST } from "./route";

const reviewer = {
  workspaceId: "workspace-a",
  workspace: { id: "workspace-a", name: "مجلس الاختبار" },
  user: { id: "reviewer-a", email: "curator@example.test" },
  role: "REVIEWER"
};

function request(body: unknown, origin = "https://majalis.example") {
  return new NextRequest("https://majalis.example/api/sources", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("shared source registration authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue(reviewer);
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.isCatalogueCurator.mockReturnValue(true);
    mocks.safeExternalHttpUrl.mockImplementation((url: string) => url);
    mocks.sourceCreate.mockResolvedValue({
      id: "source-a", title: "مرجع تجريبي", author: null, publisher: null,
      publicationYear: null, edition: null, url: null, createdAt: new Date("2026-01-01T00:00:00.000Z")
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit-a" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        source: { create: mocks.sourceCreate },
        auditLog: { create: mocks.auditCreate }
      })
    );
  });

  it("rejects an untrusted origin before resolving workspace or writing", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request({ title: "مرجع تجريبي" }, "https://attacker.example"));

    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("denies reviewers who are not on the server-side curator allowlist", async () => {
    mocks.isCatalogueCurator.mockReturnValue(false);
    const response = await POST(request({ title: "مرجع تجريبي" }));

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.sourceCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("denies a member without reviewer role even if their email is allowlisted", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ ...reviewer, role: "VIEWER" });
    mocks.roleAtLeast.mockReturnValue(false);
    const response = await POST(request({ title: "مرجع تجريبي" }));

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates only unverified bibliographic metadata and audits it transactionally", async () => {
    const response = await POST(request({ title: "مرجع تجريبي", url: "https://example.test/book" }));

    expect(response.status).toBe(201);
    expect(mocks.sourceCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: "مرجع تجريبي",
        accessStatus: "NOT_CHECKED",
        extractionStatus: "NOT_ATTEMPTED",
        humanReviewed: false
      })
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-a",
        actorUserId: "reviewer-a",
        action: "CATALOGUE_SOURCE_CREATED",
        targetType: "Source"
      })
    }));
  });

  it("rejects an unsafe source URL without writing", async () => {
    mocks.safeExternalHttpUrl.mockReturnValue(null);
    const response = await POST(request({ title: "مرجع تجريبي", url: "file:///etc/passwd" }));

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
