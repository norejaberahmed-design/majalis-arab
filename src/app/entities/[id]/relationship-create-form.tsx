"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type EntityOption = { id: string; name: string; kind: string };
type ClaimOption = { id: string; statement: string };

const relationTypes = [
  { value: "BRANCH_OF", label: "فرع من" },
  { value: "RELATED_TO", label: "مرتبط بـ" },
  { value: "PARENT_OF", label: "والد/أصل لـ" },
  { value: "CHILD_OF", label: "ابن/فرع لـ" },
  { value: "SIBLING_OF", label: "أخ/نظير لـ" },
  { value: "SPOUSE_OF", label: "زوج/زوجة لـ" },
  { value: "LOCATED_IN", label: "يقع في" },
  { value: "OTHER", label: "أخرى" }
];

export default function RelationshipCreateForm({ fromEntityId, targets, claims }: {
  fromEntityId: string;
  targets: EntityOption[];
  claims: ClaimOption[];
}) {
  const router = useRouter();
  const [toEntityId, setToEntityId] = useState(targets[0]?.id ?? "");
  const [relationshipType, setRelationshipType] = useState("RELATED_TO");
  const [claimId, setClaimId] = useState(claims[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/curation/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromEntityId, toEntityId, relationshipType, claimId, description })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر تسجيل العلاقة.");
        return;
      }
      setMessage(result.message || "تم تسجيل العلاقة.");
      setDescription("");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="entity-form">
      <h2>تسجيل علاقة موثقة</h2>
      <p className="muted">لا يمكن تسجيل علاقة من الاسم وحده. اختر ادعاءً مراجعًا ومصنفًا «مدعومًا» وله مقطع دليل مراجع بشريًا، ثم اشرح سبب الربط.</p>
      {targets.length === 0 || claims.length === 0 ? (
        <div className="empty-state"><strong>لا توجد بيانات كافية لتسجيل علاقة</strong><p>يلزم كيان آخر وادعاء مدعوم ومراجع مرتبط بالكيان الحالي.</p></div>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="relationship-target">الكيان المرتبط</label>
          <select id="relationship-target" value={toEntityId} onChange={e => setToEntityId(e.target.value)} required>
            {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
          </select>
          <label htmlFor="relationship-type">نوع العلاقة واتجاهها</label>
          <select id="relationship-type" value={relationshipType} onChange={e => setRelationshipType(e.target.value)}>
            {relationTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <label htmlFor="relationship-claim">الادعاء المعتمد الذي يستند إليه الربط</label>
          <select id="relationship-claim" value={claimId} onChange={e => setClaimId(e.target.value)} required>
            {claims.map(claim => <option key={claim.id} value={claim.id}>{claim.statement}</option>)}
          </select>
          <label htmlFor="relationship-description">شرح العلاقة وحدود الدليل</label>
          <textarea id="relationship-description" value={description} onChange={e => setDescription(e.target.value)} minLength={10} maxLength={1000} rows={3} required placeholder="وضح ما يقوله الادعاء وما لا يثبته المصدر" />
          {error && <p className="warning-note" role="alert">{error}</p>}
          {message && <p className="status-label" role="status">{message}</p>}
          <button className="primary-button" type="submit" disabled={busy || description.trim().length < 10}>{busy ? "جارٍ التسجيل…" : "تسجيل العلاقة"}</button>
        </form>
      )}
    </section>
  );
}
