"use client";

import { useState } from "react";

export default function EntityWorkspaceNote({ entityId, initialNote, canEdit }: { entityId: string; initialNote: string | null; canEdit: boolean }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [savedNote, setSavedNote] = useState(initialNote ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/entities/${encodeURIComponent(entityId)}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "تعذر حفظ الملاحظة."); return; }
      setSavedNote(result.data.note);
      setMessage("حُفظت داخل مساحة العمل فقط.");
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/entities/${encodeURIComponent(entityId)}/note`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "تعذر حذف الملاحظة."); return; }
      setNote("");
      setSavedNote("");
      setMessage("حُذفت الملاحظة من مساحة العمل.");
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="workspace-note">
      <summary>{savedNote ? "عرض ملاحظة مساحة العمل" : "إضافة ملاحظة خاصة بالمساحة"}</summary>
      {canEdit ? <>
        <label htmlFor={`workspace-note-${entityId}`}>ملاحظة داخلية (لا تغيّر السجل المشترك)</label>
        <textarea id={`workspace-note-${entityId}`} rows={3} maxLength={5000} value={note} onChange={e => setNote(e.target.value)} placeholder="سجّل سياقًا أو مهمة تحقق لفريقك، لا حقيقة منشورة." />
        <div className="note-actions">
          <button type="button" disabled={busy || !note.trim() || note === savedNote} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ الملاحظة"}</button>
          {savedNote && <button type="button" disabled={busy} onClick={remove}>حذف</button>}
        </div>
      </> : <p className="muted">{savedNote || "لا توجد ملاحظة في مساحة العمل."}</p>}
      {message && <p className="form-message" role="status">{message}</p>}
      {!canEdit && savedNote && <p className="muted">هذه الملاحظة تخص مساحة العمل الحالية وليست جزءًا من الكتالوج المشترك.</p>}
    </details>
  );
}
