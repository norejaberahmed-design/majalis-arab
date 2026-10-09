"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Entity = {
  id: string;
  name: string;
  kind: string;
  summary: string | null;
  claimsCount?: number;
  passagesCount?: number;
  relationshipsCount?: number;
};

const labels: Record<string, string> = {
  TRIBE: "قبيلة", CLAN: "فرع", FAMILY: "أسرة",
  PERSON: "شخص", PLACE: "مكان", OTHER: "نوع آخر"
};

export default function EntitySearchPanel({
  initialEntities,
  initialQuery
}: {
  initialEntities: Entity[];
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [entities, setEntities] = useState<Entity[]>(initialEntities);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value.length > 100) {
      setError("عبارة البحث أطول من 100 حرف.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (value) params.set("q", value);
      const response = await fetch(`/api/entities?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر إكمال البحث.");
      if (!Array.isArray(payload.data)) throw new Error("استجابة البحث غير صالحة.");
      setEntities(payload.data.map((item: Entity) => ({
        id: item.id, name: item.name, kind: item.kind, summary: item.summary
      })));
      setSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر الاتصال بخدمة البحث.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="page-intro">
        <p className="eyebrow">قاعدة المعرفة القبلية</p>
        <h1>البحث في الكيانات</h1>
        <p className="intro">تصفح السجلات البحثية المشتركة. وجود اسم في الدليل لا يثبت النسب أو صحة الروايات المرتبطة به؛ افتح الادعاءات والمصادر لفحص الأدلة.</p>
        <form onSubmit={submit} className="search-form">
          <label htmlFor="entity-query">اسم القبيلة أو الفرع أو المكان</label>
          <div className="search-row">
            <input id="entity-query" type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="اكتب الاسم بالعربية…" />
            <button type="submit" className="primary-button" disabled={busy}>{busy ? "جارٍ البحث…" : "بحث"}</button>
          </div>
          {error && <p className="form-message" role="alert">{error}</p>}
        </form>
      </section>
      <section className="panel list-panel" aria-live="polite">
        <div className="list-heading">
          <h2>{searched && query.trim() ? `نتائج البحث عن «${query.trim()}»` : "سجلات الكتالوج"}</h2>
          <span className="count-pill">{entities.length}</span>
        </div>
        {entities.length === 0 ? (
          <div className="empty-state">
            <strong>{searched || initialQuery ? "لا توجد نتائج مطابقة" : "لا توجد سجلات بعد"}</strong>
            <p>{searched || initialQuery ? "لا نستنتج معلومات عن الاسم عند غياب سجل موثق. يمكنك تقديم اقتراح إضافة مع مصدر قابل للتحقق بعد تسجيل الدخول." : "لم نضف بيانات قبلية افتراضية. ستظهر السجلات بعد إدخالها ومراجعة مصادرها."}</p>
          </div>
        ) : (
          <div className="entity-list">
            {entities.map(entity => (
              <article className="entity-row" key={entity.id}>
                <div className="entity-record-summary">
                  <h3><Link href={`/entities/${encodeURIComponent(entity.id)}`} className="text-link">{entity.name} ←</Link></h3>
                  <p>{entity.summary || "لا يوجد ملخص موثق مسجل لهذا الكيان."}</p>
                  <small>{labels[entity.kind] ?? "نوع غير محدد"}{entity.claimsCount !== undefined ? ` · ${entity.claimsCount} ادعاء` : ""}{entity.passagesCount !== undefined ? ` · ${entity.passagesCount} مقطع دليل` : ""}{entity.relationshipsCount !== undefined ? ` · ${entity.relationshipsCount} علاقة مسجلة` : ""}</small>
                  <p><Link className="text-link" href="/claims">فحص الادعاءات ←</Link>{" "}<Link className="text-link" href="/sources">تصفح المصادر ←</Link></p>
                </div>
                <span className="status-label">سجل بحثي</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
