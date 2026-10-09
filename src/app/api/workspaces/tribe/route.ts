import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });

    const [link, candidates] = await Promise.all([
      prisma.workspaceTribe.findUnique({
        where: { workspaceId: context.workspaceId },
        select: { entity: { select: { id: true, name: true, kind: true } }, createdAt: true }
      }),
      prisma.tribalEntity.findMany({
        where: { kind: { in: ["TRIBE", "CLAN"] } },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, name: true, kind: true }
      })
    ]);

    return NextResponse.json({
      data: {
        linkedTribe: link?.entity ?? null,
        linkedAt: link?.createdAt.toISOString() ?? null,
        candidates,
        canManage: roleAtLeast(context.role, "OWNER")
      }
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Tribal council link lookup failed", error);
    return NextResponse.json({ error: "تعذر تحميل ارتباط المجلس بالقبيلة" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "OWNER")) return NextResponse.json({ error: "ربط المجلس بقبيلة متاح لمالك المجلس فقط" }, { status: 403, headers: NO_STORE });

    const body = await readJsonBody(request, 2048);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const entityId = body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>).entityId
      : null;
    if (typeof entityId !== "string" || entityId.length < 1 || entityId.length > 64) {
      return NextResponse.json({ error: "اختر قبيلة أو فرعًا مسجلًا" }, { status: 400, headers: NO_STORE });
    }

    const entity = await prisma.tribalEntity.findUnique({
      where: { id: entityId },
      select: { id: true, name: true, kind: true }
    });
    if (!entity || !["TRIBE", "CLAN"].includes(entity.kind)) {
      return NextResponse.json({ error: "الكيان غير موجود أو ليس قبيلة/فرعًا" }, { status: 404, headers: NO_STORE });
    }

    const link = await prisma.$transaction(async tx => {
      const saved = await tx.workspaceTribe.upsert({
        where: { workspaceId: context.workspaceId },
        create: { workspaceId: context.workspaceId, entityId: entity.id },
        update: { entityId: entity.id },
        select: { workspaceId: true, entityId: true, createdAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "WORKSPACE_TRIBE_LINKED",
          targetType: "TribalEntity",
          targetId: entity.id,
          details: JSON.stringify({ workspaceId: context.workspaceId })
        }
      });
      return saved;
    });

    return NextResponse.json({ data: { ...link, entity }, message: "تم ربط المجلس بسجل القبيلة. هذا الربط لا يثبت نسب أي عضو." }, { headers: NO_STORE });
  } catch (error) {
    console.error("Tribal council link update failed", error);
    return NextResponse.json({ error: "تعذر ربط المجلس بالقبيلة" }, { status: 503, headers: NO_STORE });
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "OWNER")) return NextResponse.json({ error: "فصل ارتباط القبيلة متاح لمالك المجلس فقط" }, { status: 403, headers: NO_STORE });

    const existing = await prisma.workspaceTribe.findUnique({
      where: { workspaceId: context.workspaceId },
      select: { entityId: true }
    });
    if (!existing) return NextResponse.json({ data: { unlinked: true } }, { headers: NO_STORE });

    await prisma.$transaction(async tx => {
      await tx.workspaceTribe.delete({ where: { workspaceId: context.workspaceId } });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "WORKSPACE_TRIBE_UNLINKED",
          targetType: "TribalEntity",
          targetId: existing.entityId,
          details: JSON.stringify({ workspaceId: context.workspaceId })
        }
      });
    });
    return NextResponse.json({ data: { unlinked: true } }, { headers: NO_STORE });
  } catch (error) {
    console.error("Tribal council unlink failed", error);
    return NextResponse.json({ error: "تعذر فصل ارتباط المجلس بالقبيلة" }, { status: 503, headers: NO_STORE });
  }
}
