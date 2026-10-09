"use client";

import { FormEvent, useEffect, useState } from "react";

type AdditionRequest = {
  id: string;
  proposedName: string;
  proposedKind: string;
  explanation: string;
  sourceUrl: string | null;
  status: string;
  reviewerNote: string | null;
  createdAt: string;
};

const kinds = [
  ["TRIBE", "قبيلة"], ["CLAN", "فرع"], ["FAMILY", "أسرة"],
  ["PERSON", "شخص"], ["PLACE", "مكان"], ["OTHER", "نوع آخر"]
];

const statuses: Record<string, string> = {
  SUBMITTED: "مرسل للمراجعة",
  UNDER_REVIEW: "قيد المراجعة",
  APPROVED: "مقبول",
  REJECTED: "مرفوض"
};

export default function EntityForm() {
  const [proposedName, setProposedName] = useState("");
  const [proposedKind, setProposedKind] = useState("TRIBE");
  const [explanation, setExplanation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [requests, setRequests] = useState<AdditionRequest[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadRequests() {
    try {
      const response = await fetch("/api/addition-requests", { cache: "no-store" });
      const result = await response.json();
      if (response.ok && Array.isArray(result.data)) setRequests(result.data);
    } catch {
      // Submission remains usable if the request history cannot be loaded.
    }
  }

  useEffect(() => { void loadRequests(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/addition-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedName, proposedKind, explanation, sourceUrl })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر إرسال الطلب.");
        return;
      }
      setMessage(result.message || "تم إرسال الطلب.");
      setProposedName("");
      setExplanation("");
      setSourceUrl("");
      await loadRequests();
    } catch {
      setError("تعذر الاتصال بالخدمة. لم نتمكن من تأكيد حفظ الطلب.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="entity-form" aria-labelledby="entity-form-heading">
      <h2 id="entity-form-heading">اقتراح كيان للكتالوج</h2>
      <p className="muted">
        يُرسل اقتراحك إلى مساحة العمل الحالية للمراجعة. لا يُضاف مباشرة إلى الكتالوج المشترك، ولا يُعامل بوصفه حقيقة موثقة.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="proposed-name">اسم الكيان</label>
        <input id="proposed-name" value={proposedName} onChange={e => setProposedName(e.target.value)} minLength={2} maxLength={160} required placeholder="اكتب الاسم كما ورد في المصدر" />
        <label htmlFor="proposed-kind">نوع الكيان</label>
        <select id="proposed-kind" value={proposedKind} onChange={e => setProposedKind(e.target.value)} required>
          {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="proposed-explanation">التفسير أو سبب الاقتراح</label>
        <textarea id="proposed-explanation" value={explanation} onChange={e => setExplanation(e.target.value)} minLength={10} maxLength={3000} required rows={4} placeholder="ما الذي تريد تسجيله؟ وما حدود ما يثبته المصدر؟" />
        <label htmlFor="proposed-source">رابط المصدر (اختياري)</label>
        <input id="proposed-source" type="url" inputMode="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} maxLength={2048} placeholder="https://..." />
        {error && <p className="warning-note" role="alert">{error}</p>}
        {message && <p className="status-label" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ إرسال الطلب…" : "إرسال للمراجعة"}</button>
      </form>
      <div className="request-history">
        <h3>طلباتي الأخيرة</h3>
        {requests.length === 0 ? <p className="muted">لا توجد طلبات سابقة في هذه المساحة.</p> : requests.map(item => (
          <article className="entity-row" key={item.id}>
            <div>
              <strong>{item.proposedName}</strong>
              <p>{item.explanation}</p>
              {item.sourceUrl && <a className="text-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">فتح المصدر ↗</a>}
              {item.reviewerNote && <small>ملاحظة المراجع: {item.reviewerNote}</small>}
              <small>{new Date(item.createdAt).toLocaleDateString("ar-SA")}</small>
            </div>
            <span className={item.status === "REJECTED" ? "status-label pending" : "status-label"}>{statuses[item.status] ?? item.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
