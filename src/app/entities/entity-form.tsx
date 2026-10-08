"use client";

import { FormEvent, useState } from "react";

export default function EntityForm() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("TRIBE");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, summary, notes })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "تعذر حفظ السجل.");
        return;
      }
      setName("");
      setSummary("");
      setNotes("");
      setMessage("تم حفظ الكيان في قاعدة البيانات.");
      window.location.reload();
    } catch {
      setMessage("تعذر الاتصال بالخادم. لم يتم تأكيد الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="entity-form" onSubmit={submit}>
      <h2>إضافة كيان بحثي</h2>
      <p className="muted">أدخل بيانات أولية فقط. لا يعني إنشاء السجل أن المعلومات التاريخية مثبتة.</p>
      <label>الاسم
        <input required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="اسم الكيان كما ورد في المصدر" />
      </label>
      <label>نوع الكيان
        <select value={kind} onChange={e => setKind(e.target.value)}>
          <option value="TRIBE">قبيلة</option>
          <option value="CLAN">فرع</option>
          <option value="FAMILY">أسرة</option>
          <option value="PERSON">شخص</option>
          <option value="PLACE">مكان</option>
          <option value="OTHER">نوع آخر</option>
        </select>
      </label>
      <label>ملخص أولي (اختياري)
        <textarea maxLength={2000} rows={3} value={summary} onChange={e => setSummary(e.target.value)} placeholder="وصف محايد، دون استنتاجات غير موثقة" />
      </label>
      <label>ملاحظات الباحث (اختياري)
        <textarea maxLength={5000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="ما يحتاج إلى تحقق أو مراجعة" />
      </label>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ السجل"}</button>
      {message && <p role="status" className="form-message">{message}</p>}
    </form>
  );
}