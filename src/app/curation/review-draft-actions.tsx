"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewDraftActions({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function decide(decision: "APPROVE_DRAFT" | "REJECT_DRAFT") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/curation/drafts/${encodeURIComponent(draftId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNote: note })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر حفظ قرار المراجعة.");
        return;
      }
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم يتم تأكيد قرار المراجعة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-actions">
      <label htmlFor={`review-note-${draftId}`}>ملاحظة المراجع (اختياري)</label>
      <textarea id={`review-note-${draftId}`} rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} />
      {error && <p className="warning-note" role="alert">{error}</p>}
      <div className="hero-actions">
        <button type="button" className="primary-button" disabled={busy} onClick={() => decide("APPROVE_DRAFT")}>{busy ? "جارٍ الحفظ…" : "إضافة الادعاء إلى سجل المراجعة"}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => decide("REJECT_DRAFT")}>رفض المسودة</button>
      </div>
    </div>
  );
}
