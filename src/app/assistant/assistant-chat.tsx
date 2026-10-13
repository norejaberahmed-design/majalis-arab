"use client";

import { FormEvent, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    const nextMessages: Message[] = [...messages, { role: "user", content }].slice(-8);
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages })
      });
      const payload = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error || "تعذر الحصول على رد.");
      setMessages([...nextMessages, { role: "assistant", content: payload.answer }].slice(-8));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "حدث خطأ غير متوقع.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="assistant-panel" aria-label="محادثة المساعد">
      <div className="assistant-intro">
        <span className="assistant-mark" aria-hidden="true">م</span>
        <div><h2>كيف أساعدك داخل المجلس؟</h2><p>اسأل عن رواية أو اطلب تلخيصًا أو مقارنة للمعلومات التي تقدمها. يوضح المساعد حدود ما يمكن التحقق منه.</p></div>
      </div>
      <div className="assistant-messages" aria-live="polite">
        {messages.length === 0 && <div className="assistant-empty"><strong>ابدأ بسؤال واضح</strong><p>مثال: لخّص الروايتين التاليتين وحدد أوجه الاتفاق والاختلاف بينهما.</p></div>}
        {messages.map((message, index) => <article className={message.role === "user" ? "assistant-message user" : "assistant-message"} key={index}><span>{message.role === "user" ? "أنت" : "مساعد مجالس العرب"}</span><p>{message.content}</p></article>)}
        {busy && <div className="assistant-status" role="status">يُعدّ الرد…</div>}
      </div>
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <form className="assistant-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="assistant-prompt">رسالتك للمساعد</label>
        <textarea id="assistant-prompt" value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={3} placeholder="اكتب سؤالك أو النص الذي تريد تحليله…" required disabled={busy} />
        <div className="assistant-form-footer"><small>لا ترسل معلومات شخصية حساسة. لا تُحفظ المحادثة في قاعدة بيانات المنصة.</small><button type="submit" disabled={busy || !draft.trim()}>{busy ? "جارٍ الرد…" : "إرسال السؤال"}</button></div>
      </form>
    </section>
  );
}
