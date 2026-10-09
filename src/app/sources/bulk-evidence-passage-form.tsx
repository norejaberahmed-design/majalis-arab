"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { parseEvidencePassageBatch } from "@/lib/evidence-passage-batch";

export default function BulkEvidencePassageForm({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const parsed = parseEvidencePassageBatch(input);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/sources/${encodeURIComponent(sourceId)}/passages/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passages: parsed.passages })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر استيراد المقاطع.");
        return;
      }
      setMessage(result.message || "تم استيراد المقاطع.");
      setInput("");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد استيراد المقاطع.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="entity-form" aria-labelledby="bulk-evidence-heading">
      <h2 id="bulk-evidence-heading">إضافة عدة مقاطع دفعة واحدة</h2>
      <p className="muted">انسخ الصفوف من جدول بيانات: موضع الصفحة، ثم نص المقطع، ثم محدد إضافي اختياري. افصل الأعمدة بعلامة تبويب، وأدخل حتى 50 مقطعًا. تُحفظ المقاطع دون اعتبارها مراجعة بشريًا.</p>
      <form onSubmit={submit}>
        <label htmlFor="bulk-evidence-input">صفوف المقاطع المنقولة من المصدر</label>
        <textarea
          id="bulk-evidence-input"
          rows={8}
          value={input}
          onChange={event => setInput(event.target.value)}
          maxLength={300000}
          required
          placeholder={"الصفحة\tنص المقطع\tالمحدد الإضافي (اختياري)\nص 12\tالنص المنقول حرفيًا من المصدر...\tالباب الأول"}
        />
        {error && <p className="warning-note" role="alert">{error}</p>}
        {message && <p className="status-label" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ الاستيراد…" : "استيراد المقاطع"}</button>
      </form>
    </section>
  );
}
