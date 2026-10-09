import Link from "next/link";
import WorkspaceActions from "@/app/workspace-actions";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";
import CouncilFeed from "./council-feed";

export const dynamic = "force-dynamic";

export default async function CouncilPage() {
  const workspace = await requireWorkspace();
  const posts = await prisma.councilPost.findMany({
    where: { workspaceId: workspace.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true, content: true, createdAt: true, updatedAt: true,
      author: { select: { id: true, name: true, image: true } },
      comments: {
        orderBy: { createdAt: "asc" },
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
        <Link href="/council" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>المجلس والحوار</small></span></Link>
        <WorkspaceActions />
      </header>
      <section className="page-intro council-intro">
        <p className="eyebrow">مجتمعك يبدأ من هنا</p>
        <h1>المجلس العربي</h1>
        <p className="intro">مكان للأحاديث والأسئلة وتبادل الخبرات بين الأعضاء. انشر حديثًا، شارك في النقاش، وتفاعل مع ما يهم مجلسك.</p>
      </section>
      <CouncilFeed initialPosts={initialPosts} workspaceName={workspace.workspace.name} />
    </main>
  );
}
