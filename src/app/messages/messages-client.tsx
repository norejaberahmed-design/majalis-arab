"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

type Person = { id: string; name: string; image: string | null };
type Member = Person & { role: string; joinedAt: string };
type Message = { id: string; content: string; createdAt: string; authorId: string; author: Person };
type Conversation = { id: string; participant: Person; updatedAt: string; lastMessage: { id: string; content: string; createdAt: string; authorId: string } | null };

function dateLabel(value: string) {
  return new Date(value).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

export default function MessagesClient({ workspaceName }: { workspaceName: string }) {
  const searchParams = useSearchParams();
  const requestedRecipient = searchParams.get("to");
  const [members, setMembers] = useState<Member[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientId, setRecipientId] = useState(requestedRecipient || "");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const loadIndex = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/messages", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تحميل المراسلات");
      setMembers(result.members || []);
      setConversations(result.data || []);
      if (requestedRecipient) setRecipientId(requestedRecipient);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تحميل المراسلات");
    } finally {
      setLoading(false);
    }
  }, [requestedRecipient]);

  useEffect(() => { void loadIndex(); }, [loadIndex]);

  const loadMessages = useCallback(async (conversation: Conversation) => {
    setActive(conversation);
    setNotice("");
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(conversation.id)}/messages`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تحميل الرسائل");
      setMessages(result.data || []);
    } catch (error) {
      setMessages([]);
      setNotice(error instanceof Error ? error.message : "تعذر تحميل الرسائل");
    }
  }, []);

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipientId) return;
    setNotice("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantUserId: recipientId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر بدء المحادثة");
      await loadIndex();
      const refreshed = await fetch("/api/messages", { cache: "no-store" });
      const index = await refreshed.json();
      const found = (index.data || []).find((item: Conversation) => item.id === result.data.id);
      if (found) await loadMessages(found);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر بدء المحادثة");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(active.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر إرسال الرسالة");
      setMessages(current => [...current, result.data]);
      setDraft("");
      await loadIndex();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="messages-panel">
      <div className="messages-panel-heading"><div><p className="eyebrow">المجلس الحالي</p><h2>{workspaceName}</h2></div><span className="messages-private-badge">محادثات خاصة</span></div>
      {notice && <p className="form-message" role="status">{notice}</p>}
      <div className="messages-layout">
        <aside className="messages-list">
          <h3>محادثاتك</h3>
          {loading ? <p className="muted">جارٍ تحميل المحادثات…</p> : conversations.length === 0 ? <p className="muted">لا توجد محادثات بعد. اختر عضوًا لبدء محادثة خاصة.</p> :
            conversations.map(conversation => (
              <button type="button" className={active?.id === conversation.id ? "messages-conversation active" : "messages-conversation"} key={conversation.id} onClick={() => void loadMessages(conversation)}>
                <span className="messages-person-avatar">{conversation.participant.name.trim().slice(0, 1) || "ع"}</span>
                <span className="messages-conversation-copy"><strong>{conversation.participant.name}</strong><small>{conversation.lastMessage?.content || "ابدأ الحديث"}</small></span>
              </button>
            ))}
          <form className="messages-start-form" onSubmit={startConversation}>
            <label htmlFor="message-recipient">ابدأ محادثة جديدة</label>
            <select id="message-recipient" value={recipientId} onChange={event => setRecipientId(event.target.value)} required>
              <option value="">اختر عضوًا من المجلس</option>
              {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <button className="primary-button" type="submit" disabled={!recipientId}>فتح المحادثة</button>
          </form>
        </aside>
        <section className="messages-thread" aria-label="الرسائل">
          {!active ? <div className="empty-state"><strong>اختر محادثة</strong><p>ستظهر الرسائل هنا بعد اختيار محادثة أو بدء واحدة جديدة.</p></div> : <>
            <header className="messages-thread-heading"><span className="messages-person-avatar">{active.participant.name.trim().slice(0, 1) || "ع"}</span><div><strong>{active.participant.name}</strong><small>محادثة خاصة داخل المجلس</small></div></header>
            <div className="messages-thread-body">
              {messages.length === 0 ? <p className="muted">لا توجد رسائل بعد. ابدأ الحديث.</p> : messages.map(message => (
                <article className="direct-message" key={message.id}><p>{message.content}</p><small>{dateLabel(message.createdAt)}</small></article>
              ))}
            </div>
            <form className="messages-send-form" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="direct-message-draft">اكتب رسالة</label>
              <textarea id="direct-message-draft" rows={2} maxLength={4000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="اكتب رسالة خاصة…" />
              <div><small>{draft.length} / 4000</small><button className="primary-button" type="submit" disabled={sending || !draft.trim()}>{sending ? "جارٍ الإرسال…" : "إرسال الرسالة"}</button></div>
            </form>
          </>}
        </section>
      </div>
    </section>
  );
}
