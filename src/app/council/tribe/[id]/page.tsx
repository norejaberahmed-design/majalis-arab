import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";
import CouncilFeed from "@/app/council/council-feed";

export const dynamic = "force-dynamic";

export default async function TribeCouncilPage({ params }: { params: Promise<{ id: string }> }) {
  const workspace = await requireWorkspace();
  const { id } = await params;
  if (!id || id.length > 64) notFound();

  const tribe = await prisma.tribalEntity.findUnique({
    where: { id },
    select: { id: true, name: true, kind: true, summary: true }
  });
  if (!tribe || !["TRIBE", "CLAN"].includes(tribe.kind)) notFound();

  const posts = await prisma.councilPost.findMany({
    where: { tribeEntityId: tribe.id },
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

  const initialPosts = posts.map(post => ({
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.author,
    comments: post.comments.map(comment => ({ ...comment, createdAt: comment.createdAt.toISOString() })),
    commentCount: post._count.comments,
    reactionCount: post._count.reactions,
    reactedByMe: post.reactions.length > 0
  }));

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>المجلس القبلي المشترك</small></span></Link>
        <div className="workspace-actions">
          <Link href={`/entities/${tribe.id}`}>سجل القبيلة</Link>
          <Link href="/entities">البحث عن قبيلة أخرى</Link>
          <Link href="/council">المجلس العام</Link>
        </div>
      </header>
      <section className="page-intro council-intro">
        <p className="eyebrow">مجلس مشترك مرتبط بسجل الدليل</p>
        <h1>مجلس {tribe.name}</h1>
        <p className="intro">{tribe.summary || "مساحة للنقاش وتبادل المعلومات حول هذه القبيلة. المعلومات التاريخية تبقى بحاجة إلى مصادر ومراجعة."}</p>
        <p className="muted">هذا المجلس لا يثبت النسب الشخصي لأي عضو. يمكن للمستخدمين المسجلين المشاركة، وتظل المعلومات التاريخية غير المراجعة موسومة بوضوح.</p>
      </section>
      <CouncilFeed initialPosts={initialPosts} workspaceName={workspace.workspace.name} tribeEntityId={tribe.id} tribeName={tribe.name} />
    </main>
  );
}
