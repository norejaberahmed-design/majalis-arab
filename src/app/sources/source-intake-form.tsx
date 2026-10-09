"use client";

import { FormEvent, useState } from "react";

export default function SourceIntakeForm() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publicationYear, setPublicationYear] = useState("");
  const [url, setUrl] = useState("");
  const [bibliographicNote, setBibliographicNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, author, publisher,
          publicationYear: publicationYear ? Number(publicationYear) : null,
          url, bibliographicNote
        })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر تسجيل المصدر.");
        return;
      }
      setMessage(result.message || "تم تسجيل المصدر.");
      setTitle("");
      setAuthor("");
      setPublisher("");
      setPublicationYear("");
      setUrl("");
      setBibliographicNote("");
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد حفظ المصدر.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="entity-form" aria-labelledby="source-intake-heading">
      <h2 id="source-intake-heading">تسجيل مرجع موثّق البيانات</h2>
      <p className="muted">متاح لأمين الكتالوج المعتمد فقط. تسجيل بيانات الكتاب لا يعني أننا قرأناه أو تحققنا من محتواه؛ تبقى حالة الإتاحة والمراجعة غير مؤكدة حتى التحقق الفعلي.</p>
      <form onSubmit={submit}>
        <label htmlFor="source-title">عنوان الكتاب أو المرجع</label>
        <input id="source-title" value={title} onChange={event => setTitle(event.target.value)} minLength={2} maxLength={300} required />
        <label htmlFor="source-author">المؤلف</label>
        <input id="source-author" value={author} onChange={event => setAuthor(event.target.value)} maxLength={200} />
        <label htmlFor="source-publisher">الناشر أو جهة الإصدار</label>
        <input id="source-publisher" value={publisher} onChange={event => setPublisher(event.target.value)} maxLength={200} />
        <label htmlFor="source-year">سنة النشر (إن عُرفت)</label>
        <input id="source-year" type="number" inputMode="numeric" min="1" max="2100" value={publicationYear} onChange={event => setPublicationYear(event.target.value)} />
        <label htmlFor="source-url">رابط فهرس أو نسخة متاحة (اختياري)</label>
        <input id="source-url" type="url" inputMode="url" maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." />
        <label htmlFor="source-note">ملاحظة ببليوغرافية (اختياري)</label>
        <textarea id="source-note" rows={3} maxLength={3000} value={bibliographicNote} onChange={event => setBibliographicNote(event.target.value)} placeholder="الطبعة، المجلدات، بيانات الفهرسة أو حدود الوصول" />
        {error && <p className="warning-note" role="alert">{error}</p>}
        {message && <p className="status-label" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ التسجيل…" : "تسجيل المرجع"}</button>
      </form>
    </section>
  );
}
