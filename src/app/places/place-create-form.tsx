"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type PassageOption = {
  id: string; pageLabel: string | null; locator: string | null; passageText: string;
  source: { id: string; title: string };
};

export default function PlaceCreateForm({ passages }: { passages: PassageOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [passageId, setPassageId] = useState(passages[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const lat = latitude.trim() ? Number(latitude) : null;
    const lon = longitude.trim() ? Number(longitude) : null;
    if ((lat !== null && !Number.isFinite(lat)) || (lon !== null && !Number.isFinite(lon))) {
      setError("الإحداثيات يجب أن تكون أرقامًا صحيحة.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/curation/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, country, region, description, latitude: lat, longitude: lon, passageId })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر تسجيل المكان.");
        return;
      }
      setMessage(result.message || "تم تسجيل المكان.");
      setName("");
      setDescription("");
      setLatitude("");
      setLongitude("");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="entity-form">
      <h2>إضافة مكان من مقطع موثق</h2>
      <p className="muted">لا يُسجل المكان إلا إذا ظهر اسمه نصيًا في مقطع مصدر تمت مراجعته. الإحداثيات اختيارية ولا تُستنتج تلقائيًا.</p>
      {passages.length === 0 ? (
        <div className="empty-state"><strong>لا توجد مقاطع مؤهلة بعد</strong><p>راجع مصدرًا ومقطعًا يتضمن اسم المكان أولًا.</p></div>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="place-name">اسم المكان كما ورد في المصدر</label>
          <input id="place-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={160} required />
          <label htmlFor="place-country">الدولة (اختياري)</label>
          <input id="place-country" value={country} onChange={e => setCountry(e.target.value)} maxLength={120} />
          <label htmlFor="place-region">المنطقة (اختياري)</label>
          <input id="place-region" value={region} onChange={e => setRegion(e.target.value)} maxLength={120} />
          <label htmlFor="place-description">وصف مقتضب (اختياري)</label>
          <textarea id="place-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={2} />
          <label htmlFor="place-latitude">خط العرض (اختياري)</label>
          <input id="place-latitude" inputMode="decimal" type="number" min="-90" max="90" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} />
          <label htmlFor="place-longitude">خط الطول (اختياري)</label>
          <input id="place-longitude" inputMode="decimal" type="number" min="-180" max="180" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} />
          <label htmlFor="place-passage">مقطع المصدر المراجع</label>
          <select id="place-passage" value={passageId} onChange={e => setPassageId(e.target.value)} required>
            {passages.map(p => <option key={p.id} value={p.id}>{p.source.title} · {p.pageLabel || p.locator || "موضع غير محدد"}</option>)}
          </select>
          <p className="muted">سيُحفظ رابط مباشر إلى المصدر والمقطع، مع الموضع الذي سجله الباحث.</p>
          {error && <p className="warning-note" role="alert">{error}</p>}
          {message && <p className="status-label" role="status">{message}</p>}
          <button className="primary-button" type="submit" disabled={busy || !name.trim() || !passageId}>{busy ? "جارٍ التسجيل…" : "حفظ المكان وربطه بالدليل"}</button>
        </form>
      )}
    </section>
  );
}
