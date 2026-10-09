"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const options = [
  { value: "UNDER_REVIEW", label: "قيد المراجعة" },
  { value: "SUPPORTED", label: "مدعوم بعد المراجعة" },
  { value: "DISPUTED", label: "متعارض" },
  { value: "REJECTED", label: "مرفوض" }
];

export default function ClaimReviewActions({ claimId, currentStatus }: { claimId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus === "UNREVIEWED" ? "UNDER_REVIEW" : currentStatus);
  const [reviewerNote, setReviewerNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/curation/claims/" + encodeURIComponent(claimId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewerNote })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر حفظ قرار المراجعة.");
        return;
      }
      setMessage(result.message || "تم حفظ المراجعة.");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="claim-review-actions">
      <label>قرار المراجعة
        <select value={status} onChange={e => setStatus(e.target.value)}>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>سبب القرار (إلزامي)
        <textarea value={reviewerNote} onChange={e => setReviewerNote(e.target.value)} minLength={10} maxLength={1000} rows={2} placeholder="اذكر ما راجعته ولماذا اخترت هذه الحالة" />
      </label>
      {error && <p className="warning-note" role="alert">{error}</p>}
      {message && <p className="status-label" role="status">{message}</p>}
      <button className="secondary-button" type="button" onClick={save} disabled={busy || reviewerNote.trim().length < 10}>{busy ? "جارٍ الحفظ…" : "حفظ قرار المراجعة"}</button>
    </div>
  );
}
