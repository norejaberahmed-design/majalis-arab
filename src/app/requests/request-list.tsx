"use client";

import { useState } from "react";

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

const statuses: Record<string, string> = {
  SUBMITTED: "مرسل للمراجعة",
  UNDER_REVIEW: "قيد المراجعة",
  APPROVED: "تمت الموافقة على الطلب",
  REJECTED: "مرفوض"
};

export default function RequestList({ initialRequests, canReview }: { initialRequests: AdditionRequest[]; canReview: boolean }) {
  const [requests, setRequests] = useState(initialRequests);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function review(id: string, status: "UNDER_REVIEW" | "APPROVED" | "REJECTED") {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/addition-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewerNote: notes[id] || "" })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "تعذر حفظ قرار المراجعة.");
        return;
      }
      setRequests(current => current.map(item => item.id === id ? { ...item, status: result.data.status, reviewerNote: result.data.reviewerNote } : item));
      setMessage("حُفظ قرار المراجعة. الموافقة لا تنشر الكيان تلقائيًا في الكتالوج المشترك.");
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel list-panel">
      <div className="list-heading"><h2>{canReview ? "طلبات مساحة العمل" : "طلباتي"}</h2><span className="count-pill">{requests.length}</span></div>
      {message && <p className="form-message" role="status">{message}</p>}
      {requests.length === 0 ? <div className="empty-state"><strong>لا توجد طلبات بعد</strong><p>ستظهر هنا الطلبات المحفوظة فعليًا في قاعدة البيانات لهذه المساحة.</p></div> :
        <div className="entity-list">{requests.map(item => {
          const closed = item.status === "APPROVED" || item.status === "REJECTED";
          return <article className="entity-row request-row" key={item.id}>
            <div className="request-content">
              <h3>{item.proposedName}</h3>
              <p>{item.explanation}</p>
              {item.sourceUrl && <a className="text-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">فتح المصدر ↗</a>}
              <small>{new Date(item.createdAt).toLocaleDateString("ar-SA")} · {item.proposedKind}</small>
              {item.reviewerNote && <p className="reviewer-note">ملاحظة المراجع: {item.reviewerNote}</p>}
              {canReview && !closed && <div className="review-controls">
                <label htmlFor={`review-note-${item.id}`}>ملاحظة المراجعة</label>
                <textarea id={`review-note-${item.id}`} rows={2} maxLength={2000} value={notes[item.id] ?? item.reviewerNote ?? ""} onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))} />
                <div className="review-buttons">
                  <button type="button" disabled={busyId === item.id} onClick={() => review(item.id, "UNDER_REVIEW")}>بدء المراجعة</button>
                  <button type="button" disabled={busyId === item.id} onClick={() => review(item.id, "APPROVED")}>الموافقة على الطلب</button>
                  <button type="button" disabled={busyId === item.id} onClick={() => review(item.id, "REJECTED")}>رفض الطلب</button>
                </div>
              </div>}
            </div>
            <span className={item.status === "REJECTED" ? "status-label pending" : "status-label"}>{statuses[item.status] ?? item.status}</span>
          </article>;
        })}</div>}
    </section>
  );
}
