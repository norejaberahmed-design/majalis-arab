import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: mocks.queryRaw }
}));

import { GET } from "./route";

describe("health endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports healthy only when the database probe succeeds", async () => {
    mocks.queryRaw.mockResolvedValue([{ "1": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      checks: { database: "ok" }
    });
  });

  it("does not expose database errors when the probe fails", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("private connection detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: "degraded", checks: { database: "unavailable" } });
    expect(JSON.stringify(body)).not.toContain("private connection detail");
  });
});
