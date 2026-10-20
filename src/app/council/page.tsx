import Link from "next/link";
import WorkspaceActions from "@/app/workspace-actions";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";
import CouncilFeed from "./council-feed";

export const dynamic = "force-dynamic";

export default async function CouncilPage() {
  const workspace = await requireWorkspace();
  const tribeLink = await prisma.workspaceTribe.findUnique({
    where: { workspaceId: workspace.workspaceId },
    select: {
      entity: { select: { id: true, name: true, kind: true, summary: true } }
    }
  });
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
      <section className="panel" aria-labelledby="tribe-community-heading" style={{ marginBottom: 24, minHeight: 0 }}>
        <div className="panel-heading">
          <div className="panel-icon" aria-hidden="true">م</div>
          <div>
            <p className="eyebrow">مجتمع القبيلة</p>
            <h2 id="tribe-community-heading">{tribeLink?.entity ? tribeLink.entity.name : "لم تُربط قبيلة بهذا المجلس بعد"}</h2>
            <p>{tribeLink?.entity
              ? tribeLink.entity.summary || "لا يوجد ملخص موثق مسجل لهذا الكيان حتى الآن."
              : "لا نعرض اسمًا افتراضيًا. يستطيع مالك المجلس ربطه بسجل قبيلة موجود في الدليل."}</p>
          </div>
        </div>
        <div className="hero-actions">
          {tribeLink?.entity ? (
            <>
              <Link className="primary-button" href="/tribe">ملف القبيلة وسجلها</Link>
              <Link className="secondary-button" href={`/entities/${tribeLink.entity.id}`}>المصادر والعلاقات</Link>
            </>
          ) : (
            <Link className="primary-button" href="/setup">ربط قبيلة بالمجلس</Link>
          )}
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          النقاشات أدناه محفوظة في مساحة هذا المجلس، ولا تُعد منشورات الأعضاء دليلًا تاريخيًا أو إثباتًا للنسب.
        </p>
      </section>
      <CouncilFeed initialPosts={initialPosts} workspaceName={workspace.workspace.name} />
    </main>
  );
}
