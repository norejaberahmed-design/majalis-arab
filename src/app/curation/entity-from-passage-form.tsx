"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function EntityFromPassageForm({ passageId }: { passageId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"TRIBE" | "CLAN" | "FAMILY">("TRIBE");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/curation/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, passageId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر إنشاء سجل الكيان");
      setMessage(result.message || "تم إنشاء السجل.");
      router.push(`/entities/${result.data.entity.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="review-actions" onSubmit={submit}>
      <h3>إنشاء سجل من هذا المقطع</h3>
      <p className="muted">لا يعمل هذا المسار إلا بعد مراجعة المصدر والمقطع. يجب أن يظهر الاسم نفسه في النص؛ لا يُنشأ ملخص أو ادعاء نسب تلقائيًا.</p>
      <label htmlFor={`entity-name-${passageId}`}>الاسم كما ورد في المصدر</label>
      <input id={`entity-name-${passageId}`} value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={160} required />
      <label htmlFor={`entity-kind-${passageId}`}>نوع السجل</label>
      <select id={`entity-kind-${passageId}`} value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
        <option value="TRIBE">قبيلة</option>
        <option value="CLAN">فرع</option>
        <option value="FAMILY">أسرة</option>
      </select>
      <button type="submit" className="primary-button" disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء السجل وربطه بالمصدر"}</button>
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
  );
}
