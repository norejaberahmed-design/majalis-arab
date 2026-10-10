import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  hasTrustedOrigin: vi.fn(() => true),
  getWorkspaceContext: vi.fn(),
  entityFindUnique: vi.fn(),
  entityCreate: vi.fn(),
  entryFindFirst: vi.fn(),
  entryCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  getWorkspaceContext: mocks.getWorkspaceContext
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/safe-url", () => ({ safeExternalHttpUrl: (url: string) => url.startsWith("https://") ? url : null }));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://majalis.example/api/tribes", {
    method: "POST",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
const input = { name: "قبيلة بني مثال", content: "معلومات أولية مقدمة من أحد الأعضاء وتحتاج إلى مراجعة المصادر.", sourceUrl: "https://example.test/source" };

describe("shared tribe knowledge intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "user-a", email: "user@example.test" }, role: "VIEWER" });
    mocks.entityFindUnique.mockResolvedValue(null);
    mocks.entityCreate.mockResolvedValue({ id: "tribe-a", name: input.name, kind: "TRIBE" });
    mocks.entryFindFirst.mockResolvedValue(null);
    mocks.entryCreate.mockResolvedValue({ id: "entry-a" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      tribalEntity: { findUnique: mocks.entityFindUnique, create: mocks.entityCreate },
      tribeKnowledgeEntry: { findFirst: mocks.entryFindFirst, create: mocks.entryCreate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("requires trusted origin and an authenticated workspace", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    expect((await POST(request(input))).status).toBe(403);
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue(null);
    expect((await POST(request(input))).status).toBe(401);
  });

  it("creates one shared tribe and an unreviewed knowledge entry", async () => {
    const response = await POST(request(input));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({ id: "tribe-a", created: true, entryCreated: true });
    expect(mocks.entityCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: input.name, normalizedName: "قبيلة بني مثال", kind: "TRIBE" }
    }));
    expect(mocks.entryCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entityId: "tribe-a", status: "UNREVIEWED", createdByUserId: "user-a" })
    }));
  });

  it("reuses an existing tribe and avoids duplicate knowledge entries", async () => {
    mocks.entityFindUnique.mockResolvedValue({ id: "tribe-existing", name: input.name, kind: "TRIBE" });
    mocks.entryFindFirst.mockResolvedValue({ id: "entry-existing" });
    const response = await POST(request(input));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: "tribe-existing", created: false, entryCreated: false });
    expect(mocks.entityCreate).not.toHaveBeenCalled();
    expect(mocks.entryCreate).not.toHaveBeenCalled();
  });

  it("adds new information to an existing shared tribe without duplicating the tribe", async () => {
    mocks.entityFindUnique.mockResolvedValue({ id: "tribe-existing", name: input.name, kind: "TRIBE" });
    const response = await POST(request({ ...input, content: "معلومة إضافية مختلفة عن القبيلة وتحتاج إلى مراجعة المصدر." }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: "tribe-existing", created: false, entryCreated: true });
    expect(mocks.entityCreate).not.toHaveBeenCalled();
    expect(mocks.entryCreate).toHaveBeenCalled();
  });

  it("rejects a same-name record that is not classified as a tribe", async () => {
    mocks.entityFindUnique.mockResolvedValue({ id: "person-existing", name: input.name, kind: "PERSON" });
    const response = await POST(request(input));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toContain("ليس مصنفًا كقبيلة");
    expect(mocks.entityCreate).not.toHaveBeenCalled();
    expect(mocks.entryCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
