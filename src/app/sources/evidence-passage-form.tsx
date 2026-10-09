"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function EvidencePassageForm({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [pageLabel, setPageLabel] = useState("");
  const [passageText, setPassageText] = useState("");
  const [locator, setLocator] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/sources/${encodeURIComponent(sourceId)}/passages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageLabel, passageText, locator })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر حفظ مقطع الدليل.");
        return;
      }
      setMessage(result.message || "تم حفظ المقطع.");
      setPageLabel("");
      setPassageText("");
      setLocator("");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد حفظ المقطع.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="entity-form" aria-labelledby="evidence-intake-heading">
      <h2 id="evidence-intake-heading">إضافة مقطع من المصدر</h2>
      <p className="muted">سجّل النص كما ورد في المصدر، مع رقم الصفحة أو موضع يمكن الرجوع إليه. سيبقى المقطع غير مراجع بشريًا حتى تتم مراجعته.</p>
      <form onSubmit={submit}>
        <label htmlFor="evidence-page">رقم الصفحة أو الموضع المحدد</label>
        <input id="evidence-page" value={pageLabel} onChange={event => setPageLabel(event.target.value)} minLength={1} maxLength={120} required placeholder="مثال: ج ٢، ص ١٤٥" />
        <label htmlFor="evidence-text">نص المقطع</label>
        <textarea id="evidence-text" rows={5} value={passageText} onChange={event => setPassageText(event.target.value)} minLength={10} maxLength={5000} required />
        <label htmlFor="evidence-locator">تفاصيل إضافية للعثور على الموضع (اختياري)</label>
        <input id="evidence-locator" value={locator} onChange={event => setLocator(event.target.value)} maxLength={500} placeholder="الباب أو الفصل أو رقم الحديث" />
        {error && <p className="warning-note" role="alert">{error}</p>}
        {message && <p className="status-label" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ مقطع الدليل"}</button>
      </form>
    </section>
  );
}
