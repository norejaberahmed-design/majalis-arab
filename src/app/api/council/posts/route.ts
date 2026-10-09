import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";
import { councilPostSchema } from "@/lib/council-content";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    const posts = await prisma.councilPost.findMany({
      where: { workspaceId: workspace.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true, content: true, createdAt: true, updatedAt: true,
        author: { select: { id: true, name: true, image: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, image: true } } }
        },
        reactions: { where: { userId: workspace.user.id }, select: { id: true } },
        _count: { select: { comments: true, reactions: true } }
      }
    });
    return NextResponse.json({
      data: posts.map(post => ({
        id: post.id, content: post.content, createdAt: post.createdAt, updatedAt: post.updatedAt,
        author: post.author, comments: post.comments,
        commentCount: post._count.comments, reactionCount: post._count.reactions,
        reactedByMe: post.reactions.length > 0
      }))
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Council feed load failed", error);
    return NextResponse.json({ error: "تعذر تحميل منشورات المجلس" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    const body = await readJsonBody(request, 8192);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = councilPostSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "اكتب منشورًا لا يتجاوز 5000 حرف" }, { status: 400, headers: NO_STORE });

    const post = await prisma.councilPost.create({
      data: { workspaceId: workspace.workspaceId, authorId: workspace.user.id, content: parsed.data.content },
      select: {
        id: true, content: true, createdAt: true, updatedAt: true,
        author: { select: { id: true, name: true, image: true } },
        comments: { select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, image: true } } } },
        _count: { select: { comments: true, reactions: true } }
      }
    });
    return NextResponse.json({
      data: { ...post, commentCount: post._count.comments, reactionCount: post._count.reactions, reactedByMe: false },
      message: "نُشر حديثك في المجلس الحالي."
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Council post creation failed", error);
    return NextResponse.json({ error: "تعذر نشر الحديث حاليًا" }, { status: 503, headers: NO_STORE });
  }
}
