import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { entityInputSchema, normalizeName } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const kind = request.nextUrl.searchParams.get("kind");
  const entities = await prisma.tribalEntity.findMany({
    where: {
      ...(query
        ? { OR: [
            { name: { contains: query } },
            { normalizedName: { contains: normalizeName(query) } }
          ] }
        : {}),
      ...(kind && ["TRIBE", "CLAN", "FAMILY", "PERSON", "PLACE", "OTHER"].includes(kind)
        ? { kind: kind as "TRIBE" | "CLAN" | "FAMILY" | "PERSON" | "PLACE" | "OTHER" }
        : {})
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
  return NextResponse.json({ data: entities, count: entities.length });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "صيغة JSON غير صحيحة" }, { status: 400 });
  }

  const parsed = entityInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "البيانات غير مكتملة أو غير صالحة", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const name = parsed.data.name;
  const normalizedName = normalizeName(name);
  const existing = await prisma.tribalEntity.findFirst({
    where: { normalizedName }
  });
  if (existing) {
    return NextResponse.json(
      { error: "يوجد كيان مسجل بالاسم نفسه", existingId: existing.id },
      { status: 409 }
    );
  }

  const entity = await prisma.tribalEntity.create({
    data: {
      name,
      normalizedName,
      kind: parsed.data.kind,
      summary: parsed.data.summary || null,
      notes: parsed.data.notes || null
    }
  });

  return NextResponse.json({ data: entity }, { status: 201 });
}