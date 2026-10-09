"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PassageReviewActions({ passageId }: { passageId: string }) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/curation/passages/${encodeURIComponent(passageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذرت مراجعة المقطع");
      setMessage(result.message || "تمت مراجعة المقطع.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-actions">
      <label htmlFor={`passage-review-${passageId}`}>ملاحظة المراجعة (مطلوبة)</label>
      <textarea id={`passage-review-${passageId}`} rows={2} maxLength={1000} value={reviewNote} onChange={event => setReviewNote(event.target.value)} placeholder="مثال: طابقت النص مع الصفحة المحددة في النسخة المصورة." />
      <button type="button" className="secondary-button" disabled={busy || reviewNote.trim().length < 10} onClick={submit}>{busy ? "جارٍ الحفظ…" : "تأكيد مراجعة المقطع"}</button>
      {message && <p className="form-message" role="status">{message}</p>}
    </div>
  );
}
