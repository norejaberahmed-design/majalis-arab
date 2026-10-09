"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function TribeCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/tribes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, sourceUrl })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر حفظ البيانات.");
        return;
      }
      setMessage(result.message || "تم الحفظ.");
      setName("");
      setContent("");
      setSourceUrl("");
      router.refresh();
      if (result.data?.id) router.push(`/entities/${encodeURIComponent(result.data.id)}`);
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel entity-form" aria-labelledby="create-tribe-heading">
      <h2 id="create-tribe-heading">إنشاء سجل قبيلة أو إضافة معلومات</h2>
      <p className="muted">اكتب الاسم والمعلومات المتوفرة لديك. يُحفظ السجل في قاعدة مشتركة، فيراه المستخدمون الآخرون عند فتح القبيلة نفسها. ستظهر المعلومات الجديدة بوضوح على أنها غير مراجعة، ولا تُعامل وحدها كإثبات تاريخي.</p>
      <form onSubmit={submit}>
        <label htmlFor="tribe-name">اسم القبيلة</label>
        <input id="tribe-name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={160} required placeholder="اسم القبيلة كما يُعرف" />
        <label htmlFor="tribe-content">المعلومات الأولية</label>
        <textarea id="tribe-content" value={content} onChange={event => setContent(event.target.value)} minLength={10} maxLength={3000} rows={4} required placeholder="اكتب المعلومات التي تريد حفظها للجميع" />
        <label htmlFor="tribe-source-url">رابط المصدر (اختياري)</label>
        <input id="tribe-source-url" type="url" inputMode="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} maxLength={2048} placeholder="https://..." />
        {error && <p className="warning-note" role="alert">{error}</p>}
        {message && <p className="status-label" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ القبيلة والمعلومات"}</button>
      </form>
    </section>
  );
}
