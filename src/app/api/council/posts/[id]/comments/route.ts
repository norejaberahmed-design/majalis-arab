import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";
import { councilCommentSchema } from "@/lib/council-content";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) return NextResponse.json({ error: "سجّل الدخول واختر مجلسًا" }, { status: 401, headers: NO_STORE });
    const { id } = await route.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف المنشور غير صالح" }, { status: 400, headers: NO_STORE });
    const body = await readJsonBody(request, 4096);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = councilCommentSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "اكتب تعليقًا لا يتجاوز 2000 حرف" }, { status: 400, headers: NO_STORE });

    const post = await prisma.councilPost.findFirst({
      where: { id, workspaceId: workspace.workspaceId },
      select: { id: true }
    });
    if (!post) return NextResponse.json({ error: "المنشور غير موجود في هذا المجلس" }, { status: 404, headers: NO_STORE });

    const comment = await prisma.councilComment.create({
      data: { postId: post.id, authorId: workspace.user.id, content: parsed.data.content },
      select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, image: true } } }
    });
    return NextResponse.json({ data: comment, message: "أُضيف تعليقك." }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Council comment creation failed", error);
    return NextResponse.json({ error: "تعذر إضافة التعليق" }, { status: 503, headers: NO_STORE });
  }
}
