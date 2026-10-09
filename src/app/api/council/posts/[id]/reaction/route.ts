import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const reactionSchema = z.object({ liked: z.boolean() });

export async function PUT(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    const { id } = await route.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف المنشور غير صالح" }, { status: 400, headers: NO_STORE });
    const body = await readJsonBody(request, 2048);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = reactionSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "قيمة التفاعل غير صالحة" }, { status: 400, headers: NO_STORE });

    const post = await prisma.councilPost.findFirst({
      where: { id, workspaceId: workspace.workspaceId },
      select: { id: true }
    });
    if (!post) return NextResponse.json({ error: "المنشور غير موجود في هذا المجلس" }, { status: 404, headers: NO_STORE });

    if (parsed.data.liked) {
      await prisma.councilReaction.upsert({
        where: { postId_userId: { postId: post.id, userId: workspace.user.id } },
        create: { postId: post.id, userId: workspace.user.id },
        update: {}
      });
    } else {
      await prisma.councilReaction.deleteMany({ where: { postId: post.id, userId: workspace.user.id } });
    }
    const [reactionCount, reaction] = await Promise.all([
      prisma.councilReaction.count({ where: { postId: post.id } }),
      prisma.councilReaction.findUnique({ where: { postId_userId: { postId: post.id, userId: workspace.user.id } }, select: { id: true } })
    ]);
    return NextResponse.json({ data: { liked: Boolean(reaction), reactionCount } }, { headers: NO_STORE });
  } catch (error) {
    console.error("Council reaction update failed", error);
    return NextResponse.json({ error: "تعذر تحديث التفاعل" }, { status: 503, headers: NO_STORE });
  }
}
