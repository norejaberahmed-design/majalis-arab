"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

type Person = { id: string; name: string; image: string | null };
type Comment = { id: string; content: string; createdAt: string; author: Person };
type CouncilMember = { id: string; name: string; image: string | null; role: string; joinedAt: string };
type Post = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: Person;
  comments: Comment[];
  commentCount: number;
  reactionCount: number;
  reactedByMe: boolean;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function isQuestion(content: string) {
  return content.includes("؟") || content.includes("?") || /^سؤال[:：\s]/.test(content.trim());
}

export default function CouncilFeed({ initialPosts, workspaceName, members }: { initialPosts: Post[]; workspaceName: string; members: CouncilMember[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "questions">("all");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const visiblePosts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    return posts.filter(post => {
      const matchesQuery = !normalized || post.content.toLocaleLowerCase("ar").includes(normalized)
        || post.author.name.toLocaleLowerCase("ar").includes(normalized);
      return matchesQuery && (filter === "all" || isQuestion(post.content));
    });
  }, [posts, query, filter]);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/council/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "تعذر نشر الحديث."); return; }
      setPosts(current => [result.data, ...current]);
      setContent("");
      setFilter("all");
      setQuery("");
      setMessage("نُشر حديثك في المجلس.");
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  async function addComment(postId: string) {
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;
    setBusyAction(`comment:${postId}`);
    setMessage("");
    try {
      const response = await fetch(`/api/council/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text })
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "تعذر إضافة التعليق."); return; }
      setPosts(current => current.map(post => post.id === postId
        ? { ...post, comments: [...post.comments, result.data], commentCount: post.commentCount + 1 }
        : post));
      setCommentDrafts(current => ({ ...current, [postId]: "" }));
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setBusyAction(null);
    }
  }

  async function react(post: Post) {
    setBusyAction(`reaction:${post.id}`);
    setMessage("");
    try {
      const response = await fetch(`/api/council/posts/${encodeURIComponent(post.id)}/reaction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: !post.reactedByMe })
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "تعذر تحديث التفاعل."); return; }
      setPosts(current => current.map(item => item.id === post.id
        ? { ...item, reactedByMe: result.data.liked, reactionCount: result.data.reactionCount }
        : item));
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <>
      <section className="council-banner">
        <div className="council-banner-mark" aria-hidden="true">م</div>
        <div className="council-banner-copy">
          <span className="council-banner-kicker">مجتمعك · حوار · ذاكرة</span>
          <h2>مجلس {workspaceName}</h2>
          <p>مكان يجمع أحاديث الأعضاء وأسئلتهم وذكرياتهم، مع مساحة للتاريخ والمراجع.</p>
        </div>
        <Link href="/tribe" className="council-banner-link">ملف القبيلة <span aria-hidden="true">←</span></Link>
      </section>

      <div className="council-layout council-layout-v2">
        <section className="council-main">
          <form className="compose-card compose-card-v2" onSubmit={createPost}>
            <div className="compose-heading">
              <span className="compose-avatar">م</span>
              <div><strong>ما الذي يدور في بالك؟</strong><small>اكتب حديثًا أو اطرح سؤالًا على أعضاء المجلس.</small></div>
            </div>
            <label className="sr-only" htmlFor="council-post-content">محتوى الحديث</label>
            <textarea id="council-post-content" rows={4} maxLength={5000} value={content} onChange={event => setContent(event.target.value)} placeholder="شارك فكرة، اسأل سؤالًا، أو افتح موضوعًا للنقاش…" />
            <div className="compose-tools"><span>✎ <span>نص ونقاش</span></span><span>يظهر اسمك من حسابك المسجل</span></div>
            <div className="compose-footer"><small>{content.length} / 5000</small><button className="primary-button" type="submit" disabled={busy || !content.trim()}>{busy ? "جارٍ النشر…" : "نشر في المجلس"}</button></div>
          </form>

          {message && <p className="form-message" role="status">{message}</p>}

          <div className="feed-toolbar">
            <div><p className="eyebrow">مساحة الأعضاء</p><h2>النقاشات والمنشورات</h2></div>
            <label className="council-search">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">ابحث في المنشورات</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث في أحاديث المجلس…" />
            </label>
          </div>
          <div className="feed-filters" role="group" aria-label="تصفية المنشورات">
            <button type="button" className={filter === "all" ? "feed-filter active" : "feed-filter"} onClick={() => setFilter("all")}>كل الأحاديث <span>{posts.length}</span></button>
            <button type="button" className={filter === "questions" ? "feed-filter active" : "feed-filter"} onClick={() => setFilter("questions")}>أسئلة الأعضاء</button>
          </div>

          <div className="feed-heading"><h2>{filter === "questions" ? "أسئلة الأعضاء" : "أحدث ما نُشر"}</h2><span>{visiblePosts.length} منشورًا</span></div>
          {visiblePosts.length === 0 ? <div className="empty-state"><strong>{query ? "لم نعثر على نتائج" : filter === "questions" ? "لا توجد أسئلة ظاهرة بعد" : "المجلس يبدأ بك"}</strong><p>{query ? "جرّب كلمة أخرى للبحث في المنشورات وأسماء أصحابها." : "شارك أول حديث أو سؤال ليفتح باب النقاش مع أعضاء المجلس."}</p></div> :
            <div className="council-feed">{visiblePosts.map(post => (
              <article className="post-card post-card-v2" key={post.id}>
                <header className="post-header">
                  <span className="post-avatar">{post.author.name.trim().slice(0, 1) || "ع"}</span>
                  <div className="post-author"><strong>{post.author.name}</strong><small>{formatDate(post.createdAt)}</small></div>
                  <span className="post-menu-label">{isQuestion(post.content) ? "سؤال" : "حديث المجلس"}</span>
                </header>
                <p className="post-content">{post.content}</p>
                <div className="post-stats"><span>♥ {post.reactionCount} تفاعل</span><span>◯ {post.commentCount} تعليق</span></div>
                <div className="post-actions">
                  <button type="button" className={post.reactedByMe ? "post-action active" : "post-action"} disabled={busyAction === `reaction:${post.id}`} onClick={() => react(post)}>{post.reactedByMe ? "♥ أعجبني" : "♡ أعجبني"}</button>
                  <a className="post-action" href={`#comments-${post.id}`}>◯ شارك في النقاش</a>
                </div>
                <div className="post-comments" id={`comments-${post.id}`}>
                  {post.comments.map(comment => <div className="comment-row" key={comment.id}><span className="comment-avatar">{comment.author.name.trim().slice(0, 1) || "ع"}</span><div className="comment-bubble"><strong>{comment.author.name}</strong><p>{comment.content}</p><small>{formatDate(comment.createdAt)}</small></div></div>)}
                  {post.commentCount > post.comments.length && <small className="muted">يعرض أحدث جزء من التعليقات فقط.</small>}
                  <form className="comment-form" onSubmit={event => { event.preventDefault(); void addComment(post.id); }}>
                    <label className="sr-only" htmlFor={`comment-${post.id}`}>اكتب تعليقًا</label>
                    <input id={`comment-${post.id}`} value={commentDrafts[post.id] || ""} maxLength={2000} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} placeholder="اكتب ردًا مفيدًا…" />
                    <button type="submit" disabled={busyAction === `comment:${post.id}` || !(commentDrafts[post.id] || "").trim()}>إرسال</button>
                  </form>
                </div>
              </article>
            ))}</div>}
        </section>

        <aside className="council-sidebar">
          <section className="sidebar-card sidebar-card-v2"><p className="eyebrow">مجلسك الحالي</p><h2>{workspaceName}</h2><p>المنشورات والتعليقات هنا مرتبطة بمساحة العمل الحالية، ويظهر اسم الكاتب من حسابه المسجل.</p><div className="sidebar-divider" /><Link href="/setup" className="sidebar-action">إعدادات المجلس <span>←</span></Link></section>
          <section className="sidebar-card sidebar-card-v2 members-card-v2">
            <div className="members-heading"><div><p className="eyebrow">أهل المجلس</p><h2>الأعضاء</h2></div><span>{members.length}</span></div>
            {members.length === 0 ? <p className="muted">لا توجد عضويات ظاهرة في هذا المجلس بعد.</p> : <div className="council-members-list">{members.map(member => (
              <div className="council-member-row" key={member.id}>
                <span className="council-member-avatar">{member.image ? <img src={member.image} alt="" /> : (member.name.trim().slice(0, 1) || "ع")}</span>
                <span className="council-member-details"><strong>{member.name}</strong><small>{member.role === "OWNER" ? "مالك المجلس" : member.role === "EDITOR" ? "محرر" : member.role === "REVIEWER" ? "مراجع" : "عضو"}</small></span>
              </div>
            ))}</div>}
            <Link href="/setup" className="sidebar-action members-manage-link">إدارة الأعضاء <span>←</span></Link>
          </section>
          <section className="sidebar-card sidebar-card-v2"><h2>تصفّح المجلس</h2><nav className="council-nav"><Link href="/tribe">تاريخ القبيلة وملفها</Link><Link href="/entities">دليل الكيانات</Link><Link href="/sources">المصادر والمراجع</Link><Link href="/claims">الروايات والادعاءات التاريخية</Link><Link href="/requests">طلبات الإضافة</Link></nav></section>
          <section className="sidebar-note sidebar-note-v2"><strong>الذاكرة مسؤولية</strong><p>شارك الروايات باحترام، وأرفق المصدر عند الحديث عن التاريخ. المعلومة غير المراجعة لا تُعرض كحقيقة مؤكدة.</p></section>
        </aside>
      </div>
    </>
  );
}
