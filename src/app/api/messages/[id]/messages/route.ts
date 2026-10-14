import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const messageSchema = z.object({ content: z.string().trim().min(1).max(4000) }).strict();

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthorizedConversation(id: string, workspaceId: string, userId: string) {
  if (!id || id.length > 64) return null;
  return prisma.directConversation.findFirst({
    where: {
      id,
      workspaceId,
      OR: [{ participantAId: userId }, { participantBId: userId }]
    },
    select: { id: true, workspaceId: true, participantAId: true, participantBId: true }
  });
}

export async function GET(request: NextRequest, route: RouteContext) {
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    const { id } = await route.params;
    const conversation = await getAuthorizedConversation(id, workspace.workspaceId, workspace.user.id);
    if (!conversation) return NextResponse.json({ error: "المحادثة غير موجودة أو ليس لديك صلاحية الوصول إليها" }, { status: 404, headers: NO_STORE });

    const messages = await prisma.directMessage.findMany({
      where: { conversationId: conversation.id, workspaceId: workspace.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, content: true, createdAt: true, authorId: true, author: { select: { id: true, name: true, image: true } } }
    });
    return NextResponse.json({ data: messages.reverse() }, { headers: NO_STORE });
  } catch (error) {
    console.error("Direct messages load failed", error);
    return NextResponse.json({ error: "تعذر تحميل الرسائل" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest, route: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    const { id } = await route.params;
    const conversation = await getAuthorizedConversation(id, workspace.workspaceId, workspace.user.id);
    if (!conversation) return NextResponse.json({ error: "المحادثة غير موجودة أو ليس لديك صلاحية الوصول إليها" }, { status: 404, headers: NO_STORE });

    const body = await readJsonBody(request, 8192);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = messageSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "اكتب رسالة لا تتجاوز 4000 حرف" }, { status: 400, headers: NO_STORE });

    const message = await prisma.directMessage.create({
      data: { workspaceId: workspace.workspaceId, conversationId: conversation.id, authorId: workspace.user.id, content: parsed.data.content },
      select: { id: true, content: true, createdAt: true, authorId: true, author: { select: { id: true, name: true, image: true } } }
    });
    await prisma.directConversation.update({ where: { id: conversation.id }, data: { updatedAt: message.createdAt } });
    return NextResponse.json({ data: message }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Direct message creation failed", error);
    return NextResponse.json({ error: "تعذر إرسال الرسالة حاليًا" }, { status: 503, headers: NO_STORE });
  }
}
