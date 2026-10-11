"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function TribeKnowledgeEntryForm({ tribeName }: { tribeName: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/tribes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tribeName, content, sourceUrl })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر حفظ المساهمة.");
      setMessage(result.message || "تم حفظ المساهمة.");
      setContent("");
      setSourceUrl("");
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel list-panel">
      <p className="eyebrow">معرفة مشتركة</p>
      <h2>أضف معلومة إلى ملف {tribeName}</h2>
      <p className="muted">أضف معلومة قابلة للفحص، واذكر المصدر إن توفر. ستظهر المساهمة بحالة «غير مراجع» ولا تُعد إثباتًا حتى تُراجع.</p>
      <form className="form-grid" onSubmit={submit}>
        <label className="form-field">
          المعلومة
          <textarea
            value={content}
            onChange={event => setContent(event.target.value)}
            minLength={10}
            maxLength={3000}
            rows={4}
            required
            placeholder="اكتب المعلومة بوضوح، وافصل بين ما قرأته وما تستنتجه."
          />
        </label>
        <label className="form-field">
          رابط المصدر (اختياري)
          <input
            type="url"
            value={sourceUrl}
            onChange={event => setSourceUrl(event.target.value)}
            maxLength={2048}
            placeholder="https://..."
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy || content.trim().length < 10}>
          {busy ? "جارٍ إرسال المساهمة…" : "إضافة المعلومة"}
        </button>
      </form>
      {message && <p className="form-message" role={failed ? "alert" : "status"}>{message}</p>}
    </section>
  );
}
