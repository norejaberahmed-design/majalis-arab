"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SourceOption = { id: string; title: string };
type EntityOption = { id: string; name: string };
type PassageOption = { id: string; sourceId: string; pageLabel: string | null; locator: string | null; passageText: string };

export default function ClaimCreateForm({ sources, entities, passages }: {
  sources: SourceOption[];
  entities: EntityOption[];
  passages: PassageOption[];
}) {
  const router = useRouter();
  const [statement, setStatement] = useState("");
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [entityId, setEntityId] = useState("");
  const [reviewerNote, setReviewerNote] = useState("");
  const [classifications, setClassifications] = useState<Record<string, "support" | "contradict" | "none">>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sourcePassages = useMemo(() => passages.filter(p => p.sourceId === sourceId), [passages, sourceId]);
  const supportingPassageIds = sourcePassages.filter(p => classifications[p.id] === "support").map(p => p.id);
  const contradictingPassageIds = sourcePassages.filter(p => classifications[p.id] === "contradict").map(p => p.id);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/curation/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement, sourceId, entityId: entityId || null, reviewerNote, supportingPassageIds, contradictingPassageIds })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر تسجيل الادعاء.");
        return;
      }
      setMessage(result.message || "تم تسجيل الادعاء.");
      setStatement("");
      setReviewerNote("");
      setEntityId("");
      setClassifications({});
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="entity-form claim-create-form" aria-labelledby="claim-create-heading">
      <h2 id="claim-create-heading">تسجيل ادعاء مرتبط بالأدلة</h2>
      <p className="muted">اختر مصدرًا تمت مراجعته، ثم صنّف المقاطع المراجعة على أنها مؤيدة أو مناقضة. سيُحفظ الادعاء «غير مراجع» حتى تُستكمل مراجعته منفصلًا.</p>
      {sources.length === 0 || sourcePassages.length === 0 ? (
        <div className="empty-state"><strong>لا توجد أدلة مؤهلة بعد</strong><p>راجع مصدرًا ومقطعًا واحدًا على الأقل قبل إنشاء ادعاء تاريخي.</p></div>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="claim-statement">نص الادعاء</label>
          <textarea id="claim-statement" value={statement} onChange={e => setStatement(e.target.value)} minLength={8} maxLength={2000} required rows={3} placeholder="اكتب الادعاء بصياغة محددة ومحايدة" />
          <label htmlFor="claim-source">المصدر</label>
          <select id="claim-source" value={sourceId} onChange={e => { setSourceId(e.target.value); setClassifications({}); }} required>
            {sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}
          </select>
          <label htmlFor="claim-entity">الكيان المرتبط (اختياري)</label>
          <select id="claim-entity" value={entityId} onChange={e => setEntityId(e.target.value)}>
            <option value="">بدون ربط بكيان</option>
            {entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
          </select>
          <fieldset className="claim-evidence-list">
            <legend>تصنيف المقاطع المراجعة</legend>
            {sourcePassages.map(passage => (
              <article className="claim-evidence-option" key={passage.id}>
                <p>{passage.passageText.length > 360 ? passage.passageText.slice(0, 360) + "…" : passage.passageText}</p>
                <small>{passage.pageLabel || "موضع غير محدد"}{passage.locator ? " · " + passage.locator : ""}</small>
                <div className="claim-evidence-controls">
                  <label><input type="radio" name={"passage-" + passage.id} checked={classifications[passage.id] === "support"} onChange={() => setClassifications(prev => ({ ...prev, [passage.id]: "support" }))} /> يؤيد الادعاء</label>
                  <label><input type="radio" name={"passage-" + passage.id} checked={classifications[passage.id] === "contradict"} onChange={() => setClassifications(prev => ({ ...prev, [passage.id]: "contradict" }))} /> يناقض الادعاء</label>
                  <label><input type="radio" name={"passage-" + passage.id} checked={!classifications[passage.id] || classifications[passage.id] === "none"} onChange={() => setClassifications(prev => ({ ...prev, [passage.id]: "none" }))} /> غير حاسم</label>
                </div>
              </article>
            ))}
          </fieldset>
          <label htmlFor="claim-reviewer-note">ملاحظة بحثية (اختياري)</label>
          <textarea id="claim-reviewer-note" value={reviewerNote} onChange={e => setReviewerNote(e.target.value)} maxLength={1000} rows={2} placeholder="حدود الدليل أو ملاحظة أولية؛ لا تُعد حكمًا نهائيًا" />
          <p className="muted">المقاطع المصنفة «غير حاسم» لا تُربط بالادعاء. يجب اختيار مؤيد أو مناقض واحد على الأقل.</p>
          {error && <p className="warning-note" role="alert">{error}</p>}
          {message && <p className="status-label" role="status">{message}</p>}
          <button className="primary-button" type="submit" disabled={busy || !statement.trim() || supportingPassageIds.length + contradictingPassageIds.length === 0}>{busy ? "جارٍ التسجيل…" : "تسجيل الادعاء للمراجعة"}</button>
        </form>
      )}
    </section>
  );
}
