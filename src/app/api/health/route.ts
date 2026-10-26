import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Liveness/readiness probe.
 * Exposes only component status; never returns connection strings or exception details.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", checks: { database: "ok" }, timestamp: new Date().toISOString() },
      { status: 200, headers: NO_STORE }
    );
  } catch (error) {
    console.error("Health check database probe failed", error);
    return NextResponse.json(
      { status: "degraded", checks: { database: "unavailable" } },
      { status: 503, headers: NO_STORE }
    );
  }
}
