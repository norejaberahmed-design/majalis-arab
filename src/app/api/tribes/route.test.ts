import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  hasTrustedOrigin: vi.fn(() => true),
  getWorkspaceContext: vi.fn(),
  entityFindUnique: vi.fn(),
  entityCreate: vi.fn(),
  entryFindFirst: vi.fn(),
  entryCreate: vi.fn(),
  additionRequestFindFirst: vi.fn(),
  additionRequestCreate: vi.fn(),
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

describe("tribe contribution intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "user-a", email: "user@example.test" }, role: "VIEWER" });
    mocks.entityFindUnique.mockResolvedValue(null);
    mocks.entityCreate.mockResolvedValue({ id: "tribe-a", name: input.name, kind: "TRIBE" });
    mocks.entryFindFirst.mockResolvedValue(null);
    mocks.entryCreate.mockResolvedValue({ id: "entry-a" });
    mocks.additionRequestFindFirst.mockResolvedValue(null);
    mocks.additionRequestCreate.mockResolvedValue({ id: "request-a" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      tribalEntity: { findUnique: mocks.entityFindUnique, create: mocks.entityCreate },
      tribeKnowledgeEntry: { findFirst: mocks.entryFindFirst, create: mocks.entryCreate },
      additionRequest: { findFirst: mocks.additionRequestFindFirst, create: mocks.additionRequestCreate },
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

  it("queues a new tribe name for review instead of creating a shared entity", async () => {
    const response = await POST(request(input));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({ requestId: "request-a", submittedForReview: true, created: true });
    expect(mocks.entityCreate).not.toHaveBeenCalled();
    expect(mocks.additionRequestCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        workspaceId: "workspace-a",
        userId: "user-a",
        proposedName: input.name,
        proposedKind: "TRIBE",
        explanation: input.content,
        sourceUrl: input.sourceUrl,
        submitter: "user@example.test",
        status: "SUBMITTED"
      }
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "TRIBE_ADDITION_REQUEST_SUBMITTED", targetType: "AdditionRequest" })
    }));
  });

  it("does not duplicate a pending request for the same name and content", async () => {
    mocks.additionRequestFindFirst.mockResolvedValue({ id: "request-existing" });
    const response = await POST(request(input));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ requestId: "request-existing", submittedForReview: true, created: false });
    expect(mocks.additionRequestCreate).not.toHaveBeenCalled();
    expect(mocks.entityCreate).not.toHaveBeenCalled();
  });

  it("reuses an existing tribe and avoids duplicate knowledge entries", async () => {
    mocks.entityFindUnique.mockResolvedValue({ id: "tribe-existing", name: input.name, kind: "TRIBE" });
    mocks.entryFindFirst.mockResolvedValue({ id: "entry-existing" });
    const response = await POST(request(input));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: "tribe-existing", created: false, entryCreated: false, submittedForReview: false });
    expect(mocks.entityCreate).not.toHaveBeenCalled();
    expect(mocks.entryCreate).not.toHaveBeenCalled();
  });

  it("adds new information to an existing shared tribe without duplicating the tribe", async () => {
    mocks.entityFindUnique.mockResolvedValue({ id: "tribe-existing", name: input.name, kind: "TRIBE" });
    const response = await POST(request({ ...input, content: "معلومة إضافية مختلفة عن القبيلة وتحتاج إلى مراجعة المصدر." }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: "tribe-existing", created: false, entryCreated: true, submittedForReview: false });
    expect(mocks.entityCreate).not.toHaveBeenCalled();
    expect(mocks.entryCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entityId: "tribe-existing", status: "UNREVIEWED", createdByUserId: "user-a" })
    }));
  });
});
