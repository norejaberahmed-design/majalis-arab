"use client";

import Link from "next/link";
import { useState } from "react";

type Person = { id: string; name: string; image: string | null };
type Comment = { id: string; content: string; createdAt: string; author: Person };
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

export default function CouncilFeed({ initialPosts, workspaceName }: { initialPosts: Post[]; workspaceName: string }) {
  const [posts, setPosts] = useState(initialPosts);
  const [content, setContent] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function createPost(event: React.FormEvent<HTMLFormElement>) {
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
    <div className="council-layout">
      <section className="council-main">
        <form className="compose-card" onSubmit={createPost}>
          <div className="compose-heading"><span className="compose-avatar">م</span><div><strong>ابدأ حديثًا في المجلس</strong><small>شارك فكرة أو سؤالًا أو خبرًا مع أعضاء المساحة.</small></div></div>
          <label className="sr-only" htmlFor="council-post-content">محتوى الحديث</label>
          <textarea id="council-post-content" rows={4} maxLength={5000} value={content} onChange={event => setContent(event.target.value)} placeholder="ما الذي تود مشاركته مع المجلس؟" />
          <div className="compose-footer"><small>{content.length} / 5000</small><button className="primary-button" type="submit" disabled={busy || !content.trim()}>{busy ? "جارٍ النشر…" : "نشر الحديث"}</button></div>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
        <div className="feed-heading"><h2>أحاديث المجلس</h2><span>{posts.length} حديثًا محمّلًا</span></div>
        {posts.length === 0 ? <div className="empty-state"><strong>المجلس يبدأ بك</strong><p>لا توجد منشورات بعد. اكتب أول حديث وافتح باب النقاش مع أعضاء المجلس.</p></div> :
          <div className="council-feed">{posts.map(post => <article className="post-card" key={post.id}>
            <header className="post-header"><span className="post-avatar">{post.author.name.trim().slice(0, 1) || "ع"}</span><div className="post-author"><strong>{post.author.name}</strong><small>{formatDate(post.createdAt)}</small></div><span className="post-menu-label">المجلس</span></header>
            <p className="post-content">{post.content}</p>
            <div className="post-stats"><span>{post.reactionCount} تفاعل</span><span>{post.commentCount} تعليق</span></div>
            <div className="post-actions"><button type="button" className={post.reactedByMe ? "post-action active" : "post-action"} disabled={busyAction === `reaction:${post.id}`} onClick={() => react(post)}>{post.reactedByMe ? "♥ أعجبني" : "♡ أعجبني"}</button><a className="post-action" href={`#comments-${post.id}`}>◯ علّق</a></div>
            <div className="post-comments" id={`comments-${post.id}`}>
              {post.comments.map(comment => <div className="comment-row" key={comment.id}><span className="comment-avatar">{comment.author.name.trim().slice(0, 1) || "ع"}</span><div className="comment-bubble"><strong>{comment.author.name}</strong><p>{comment.content}</p><small>{formatDate(comment.createdAt)}</small></div></div>)}
              {post.commentCount > post.comments.length && <small className="muted">يعرض أحدث جزء من التعليقات فقط.</small>}
              <form className="comment-form" onSubmit={event => { event.preventDefault(); void addComment(post.id); }}>
                <label className="sr-only" htmlFor={`comment-${post.id}`}>اكتب تعليقًا</label>
                <input id={`comment-${post.id}`} value={commentDrafts[post.id] || ""} maxLength={2000} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} placeholder="اكتب تعليقًا…" />
                <button type="submit" disabled={busyAction === `comment:${post.id}` || !(commentDrafts[post.id] || "").trim()}>إرسال</button>
              </form>
            </div>
          </article>)}</div>}
      </section>
      <aside className="council-sidebar">
        <section className="sidebar-card"><p className="eyebrow">مساحتك الحالية</p><h2>{workspaceName}</h2><p>هذا المجلس مخصص للأعضاء في مساحة العمل الحالية. منشورات المجالس الأخرى لا تظهر هنا.</p></section>
        <section className="sidebar-card"><h2>روابط المجلس</h2><nav className="council-nav"><Link href="/">الرئيسية</Link><Link href="/entities">دليل الكيانات</Link><Link href="/sources">المصادر والمراجع</Link><Link href="/claims">الادعاءات التاريخية</Link><Link href="/requests">طلبات الإضافة</Link></nav></section>
        <section className="sidebar-note"><strong>حوار باحترام</strong><p>اختلف في الفكرة، لا في كرامة صاحبها. لا تنشر بيانات شخصية أو اتهامات بلا دليل.</p></section>
      </aside>
    </div>
  );
}
