"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Tribe = { id: string; name: string; kind: string };
type Data = { linkedTribe: Tribe | null; candidates: Tribe[]; canManage: boolean };

export default function TribeCouncilLink() {
  const [data, setData] = useState<Data | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/workspaces/tribe", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تحميل بيانات الربط");
      setData(result.data);
      setSelectedId(result.data.linkedTribe?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspaces/tribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: selectedId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر ربط المجلس");
      setMessage(result.message || "تم الربط.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspaces/tribe", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر فصل الربط");
      setMessage("فُصل ارتباط المجلس بالقبيلة.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel members-panel">
      <p className="eyebrow">هوية المجلس</p>
      <h2>ربط المجلس بسجل قبيلة</h2>
      <p className="muted">يربط هذا الإعداد نقاشات المجلس بملف قبيلة أو فرع موجود في الدليل. لا يثبت نسب أي عضو ولا يضيف معلومات تاريخية تلقائيًا.</p>
      {!data ? <p className="muted">جارٍ تحميل سجلات القبائل…</p> : (
        <>
          {data.linkedTribe ? (
            <p>الارتباط الحالي: <Link className="text-link" href={`/entities/${data.linkedTribe.id}`}>{data.linkedTribe.name} ←</Link></p>
          ) : <p className="muted">لم يُربط هذا المجلس بقبيلة بعد.</p>}
          {data.candidates.length === 0 ? (
            <div className="empty-state"><strong>لا توجد قبائل أو فروع مسجلة بعد</strong><p>لن ننشئ أسماء افتراضية. أضف السجل عبر مسار المراجعة والمصادر أولًا.</p></div>
          ) : data.canManage ? (
            <div className="member-add-form">
              <label htmlFor="tribal-council-entity">اختر قبيلة أو فرعًا مسجلًا</label>
              <div className="member-add-row">
                <select id="tribal-council-entity" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                  <option value="">اختر سجلًا…</option>
                  {data.candidates.map(item => <option key={item.id} value={item.id}>{item.name} · {item.kind === "TRIBE" ? "قبيلة" : "فرع"}</option>)}
                </select>
                <button type="button" disabled={busy || !selectedId} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ الربط"}</button>
              </div>
              {data.linkedTribe && <button type="button" className="secondary-button" disabled={busy} onClick={unlink}>فصل الربط</button>}
            </div>
          ) : <p className="muted">تغيير ارتباط المجلس متاح لمالك المجلس فقط.</p>}
        </>
      )}
      {message && <p className="form-message" role="status">{message}</p>}
    </section>
  );
}
