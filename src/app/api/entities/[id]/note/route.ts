import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const noteSchema = z.object({ note: z.string().trim().min(1).max(5000) });

async function getContext(request: NextRequest) {
  const workspace = await getWorkspaceContext(request.headers);
  if (!workspace) return null;
  return workspace;
}

export async function GET(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getContext(request);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    const { id } = await route.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف الكيان غير صالح" }, { status: 400, headers: NO_STORE });

    const note = await prisma.workspaceEntityNote.findUnique({
      where: { workspaceId_entityId: { workspaceId: workspace.workspaceId, entityId: id } },
      select: { id: true, note: true, userId: true, createdAt: true, updatedAt: true }
    });
    return NextResponse.json({ data: note }, { headers: NO_STORE });
  } catch (error) {
    console.error("Workspace entity note read failed", error);
    return NextResponse.json({ error: "تعذر تحميل ملاحظة مساحة العمل" }, { status: 503, headers: NO_STORE });
  }
}

export async function PUT(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const workspace = await getContext(request);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(workspace.role, "EDITOR")) return NextResponse.json({ error: "تحتاج إلى صلاحية محرر" }, { status: 403, headers: NO_STORE });

    const { id } = await route.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف الكيان غير صالح" }, { status: 400, headers: NO_STORE });
    const body = await readJsonBody(request, 8192);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = noteSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "اكتب ملاحظة من حرف إلى 5000 حرف" }, { status: 400, headers: NO_STORE });

    const entity = await prisma.tribalEntity.findUnique({ where: { id }, select: { id: true } });
    if (!entity) return NextResponse.json({ error: "الكيان غير موجود في الكتالوج المشترك" }, { status: 404, headers: NO_STORE });

    const note = await prisma.$transaction(async tx => {
      const saved = await tx.workspaceEntityNote.upsert({
        where: { workspaceId_entityId: { workspaceId: workspace.workspaceId, entityId: id } },
        create: { workspaceId: workspace.workspaceId, entityId: id, userId: workspace.user.id, note: parsed.data.note },
        update: { userId: workspace.user.id, note: parsed.data.note },
        select: { id: true, note: true, createdAt: true, updatedAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: workspace.workspaceId,
          actorUserId: workspace.user.id,
          actor: workspace.user.email,
          action: "WORKSPACE_ENTITY_NOTE_SAVED",
          targetType: "TribalEntity",
          targetId: id,
          details: JSON.stringify({ noteId: saved.id })
        }
      });
      return saved;
    });
    return NextResponse.json({ data: note, message: "حُفظت الملاحظة داخل مساحة العمل فقط." }, { headers: NO_STORE });
  } catch (error) {
    console.error("Workspace entity note save failed", error);
    return NextResponse.json({ error: "تعذر حفظ الملاحظة" }, { status: 503, headers: NO_STORE });
  }
}

export async function DELETE(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const workspace = await getContext(request);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(workspace.role, "EDITOR")) return NextResponse.json({ error: "تحتاج إلى صلاحية محرر" }, { status: 403, headers: NO_STORE });
    const { id } = await route.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف الكيان غير صالح" }, { status: 400, headers: NO_STORE });

    const deleted = await prisma.$transaction(async tx => {
      const result = await tx.workspaceEntityNote.deleteMany({
        where: { workspaceId: workspace.workspaceId, entityId: id }
      });
      if (result.count) {
        await tx.auditLog.create({
          data: {
            workspaceId: workspace.workspaceId,
            actorUserId: workspace.user.id,
            actor: workspace.user.email,
            action: "WORKSPACE_ENTITY_NOTE_DELETED",
            targetType: "TribalEntity",
            targetId: id,
            details: null
          }
        });
      }
      return result.count;
    });
    return NextResponse.json({ data: { deleted: deleted === 1 } }, { headers: NO_STORE });
  } catch (error) {
    console.error("Workspace entity note delete failed", error);
    return NextResponse.json({ error: "تعذر حذف الملاحظة" }, { status: 503, headers: NO_STORE });
  }
}
