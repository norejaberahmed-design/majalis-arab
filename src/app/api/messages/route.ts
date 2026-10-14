import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const startSchema = z.object({ participantUserId: z.string().trim().min(1).max(128) }).strict();

export async function GET(request: NextRequest) {
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });

    const [members, conversations, activeMemberIds] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId: workspace.workspaceId, userId: { not: workspace.user.id } },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { userId: true, role: true, createdAt: true, user: { select: { id: true, name: true, image: true } } }
      }),
      prisma.directConversation.findMany({
        where: {
          workspaceId: workspace.workspaceId,
          OR: [{ participantAId: workspace.user.id }, { participantBId: workspace.user.id }]
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          participantA: { select: { id: true, name: true, image: true } },
          participantB: { select: { id: true, name: true, image: true } },
          messages: { where: { workspaceId: workspace.workspaceId }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, content: true, createdAt: true, authorId: true } }
        }
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId: workspace.workspaceId },
        select: { userId: true }
      })
    ]);
    const activeMemberIdSet = new Set(activeMemberIds.map(member => member.userId));

    return NextResponse.json({
      members: members.map(member => ({ id: member.user.id, name: member.user.name, image: member.user.image, role: member.role, joinedAt: member.createdAt })),
      data: conversations
        .filter(conversation => activeMemberIdSet.has(
          conversation.participantAId === workspace.user.id ? conversation.participantBId : conversation.participantAId
        ))
        .map(conversation => ({
          id: conversation.id,
          participant: conversation.participantAId === workspace.user.id ? conversation.participantB : conversation.participantA,
          updatedAt: conversation.updatedAt,
          lastMessage: conversation.messages[0] ?? null
        }))
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Direct conversations load failed", error);
    return NextResponse.json({ error: "تعذر تحميل المراسلات" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    const body = await readJsonBody(request, 2048);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = startSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "اختر عضوًا صالحًا من المجلس" }, { status: 400, headers: NO_STORE });

    const participantUserId = parsed.data.participantUserId;
    if (participantUserId === workspace.user.id) return NextResponse.json({ error: "لا يمكنك بدء محادثة مع نفسك" }, { status: 400, headers: NO_STORE });
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.workspaceId, userId: participantUserId } },
      select: { userId: true }
    });
    if (!target) return NextResponse.json({ error: "لا يمكن مراسلة شخص ليس عضوًا في المجلس الحالي" }, { status: 404, headers: NO_STORE });

    const [participantAId, participantBId] = [workspace.user.id, participantUserId].sort((a, b) => a.localeCompare(b));
    const conversation = await prisma.directConversation.upsert({
      where: { workspaceId_participantAId_participantBId: { workspaceId: workspace.workspaceId, participantAId, participantBId } },
      create: { workspaceId: workspace.workspaceId, participantAId, participantBId },
      update: { updatedAt: new Date() },
      select: { id: true, participantAId: true, participantBId: true, updatedAt: true }
    });
    return NextResponse.json({ data: conversation }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Direct conversation creation failed", error);
    return NextResponse.json({ error: "تعذر بدء المحادثة حاليًا" }, { status: 503, headers: NO_STORE });
  }
}
