import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext(request.headers);
  if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
  const rawQuery = request.nextUrl.searchParams.get("q");
  const query = rawQuery?.trim();
  const kind = request.nextUrl.searchParams.get("kind");

  if (query && query.length > 100) {
    return NextResponse.json({ error: "عبارة البحث أطول من الحد المسموح" }, { status: 400, headers: NO_STORE });
  }
  const allowedKinds = ["TRIBE", "CLAN", "FAMILY", "PERSON", "PLACE", "OTHER"];
  if (kind && !allowedKinds.includes(kind)) {
    return NextResponse.json({ error: "نوع الكيان غير صالح" }, { status: 400, headers: NO_STORE });
  }

  try {
    const entities = await prisma.tribalEntity.findMany({
      where: {
        ...(query
          ? { OR: [
              { name: { contains: query } },
              { normalizedName: { contains: normalizeName(query) } }
            ] }
          : {}),
        ...(kind ? { kind } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        normalizedName: true,
        kind: true,
        summary: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return NextResponse.json({ data: entities, count: entities.length }, { headers: NO_STORE });
  } catch (error) {
    console.error("Entity search failed", error);
    return NextResponse.json({ error: "تعذر إكمال البحث" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }
  const context = await getWorkspaceContext(request.headers);
  if (!context) {
    return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
  }
  if (!roleAtLeast(context.role, "EDITOR")) {
    return NextResponse.json({ error: "تحتاج إلى صلاحية محرر" }, { status: 403, headers: NO_STORE });
  }
  return NextResponse.json(
    { error: "إضافة السجلات متوقفة مؤقتًا حتى اعتماد سياسة الكتالوج المشترك وصلاحيات المراجعة." },
    { status: 503, headers: { ...NO_STORE, "Retry-After": "86400" } }
  );
}
