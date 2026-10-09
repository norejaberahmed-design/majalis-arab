import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasTrustedOrigin: vi.fn(() => true),
  roleAtLeast: vi.fn(() => true),
  isCatalogueCurator: vi.fn(() => true),
  passageFindUnique: vi.fn(),
  placeFindFirst: vi.fn(),
  placeCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/workspace", () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
  hasTrustedOrigin: mocks.hasTrustedOrigin,
  roleAtLeast: mocks.roleAtLeast
}));
vi.mock("@/lib/source-intake", () => ({ isCatalogueCurator: mocks.isCatalogueCurator }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://majalis.example/api/curation/places", {
    method: "POST",
    headers: { origin: "https://majalis.example", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
const validBody = {
  name: "مدينة الرياض",
  country: "السعودية",
  region: "منطقة الرياض",
  description: "موضع مسجل وفق المقطع التاريخي المراجع، دون افتراض تفاصيل إضافية.",
  latitude: 24.7136,
  longitude: 46.6753,
  passageId: "passage-a"
};

describe("place creation from reviewed evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.roleAtLeast.mockReturnValue(true);
    mocks.isCatalogueCurator.mockReturnValue(true);
    mocks.getWorkspaceContext.mockResolvedValue({ workspaceId: "workspace-a", user: { id: "curator-a", email: "curator@example.test" }, role: "REVIEWER" });
    mocks.passageFindUnique.mockResolvedValue({
      id: "passage-a", sourceId: "source-a", pageLabel: "ص 10", locator: null,
      passageText: "ذكر النص مدينة الرياض بوصفها موضعًا في المنطقة.",
      reviewedByHuman: true,
      source: { id: "source-a", title: "مرجع تاريخي", humanReviewed: true, accessStatus: "OPEN_ACCESS" }
    });
    mocks.placeFindFirst.mockResolvedValue(null);
    mocks.placeCreate.mockResolvedValue({ id: "place-a", name: validBody.name, country: validBody.country, region: validBody.region, sourceId: "source-a", evidencePassageId: "passage-a", createdAt: new Date() });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      evidencePassage: { findUnique: mocks.passageFindUnique },
      place: { findFirst: mocks.placeFindFirst, create: mocks.placeCreate },
      auditLog: { create: mocks.auditCreate }
    }));
  });

  it("rejects untrusted origin before workspace lookup", async () => {
    mocks.hasTrustedOrigin.mockReturnValue(false);
    const response = await POST(request(validBody));
    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContext).not.toHaveBeenCalled();
  });

  it("requires reviewed source and passage", async () => {
    mocks.passageFindUnique.mockResolvedValue({
      id: "passage-a", sourceId: "source-a", passageText: "مدينة الرياض", reviewedByHuman: false,
      source: { id: "source-a", title: "Source", humanReviewed: true, accessStatus: "OPEN_ACCESS" }
    });
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    expect(mocks.placeCreate).not.toHaveBeenCalled();
  });

  it("rejects a place name not present as an independent phrase in the passage", async () => {
    mocks.passageFindUnique.mockResolvedValue({
      id: "passage-a", sourceId: "source-a", passageText: "ذكر النص موضعًا آخر.", reviewedByHuman: true,
      source: { id: "source-a", title: "Source", humanReviewed: true, accessStatus: "OPEN_ACCESS" }
    });
    const response = await POST(request(validBody));
    expect(response.status).toBe(422);
    expect(mocks.placeCreate).not.toHaveBeenCalled();
  });

  it("creates a place linked to its reviewed source passage and audits it", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(201);
    expect(mocks.placeCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: "مدينة الرياض", sourceId: "source-a", evidencePassageId: "passage-a" })
    }));
    expect(mocks.auditCreate).toHaveBeenCalled();
  });
});
