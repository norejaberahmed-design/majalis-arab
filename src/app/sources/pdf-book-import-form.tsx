"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function PdfBookImportForm({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{pdfPages:number;passagesCreated:number;passagesSkipped:number;candidateSuggestionsCreated:number;candidateSuggestionsSkipped:number;extractionModes:string[]} | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(""); setError(""); setReport(null);
    if (!file) { setError("اختر ملف PDF أولًا."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("الحد الأقصى لحجم الكتاب 20 ميغابايت."); return; }
    const body = new FormData();
    body.set("file", file);
    setBusy(true);
    try {
      const response = await fetch(`/api/sources/${encodeURIComponent(sourceId)}/pdf-import`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "تعذر استخراج الكتاب."); return; }
      setReport(result.data);
      setMessage(result.message || "اكتمل استخراج الكتاب.");
      setFile(null);
      const input = document.getElementById("genealogy-pdf-file") as HTMLInputElement | null;
      if (input) input.value = "";
      router.refresh();
    } catch {
      setError("انقطع الاتصال؛ لم نتمكن من تأكيد اكتمال الاستخراج.");
    } finally { setBusy(false); }
  }

  return (
    <section className="entity-form" aria-labelledby="pdf-import-heading">
      <h2 id="pdf-import-heading">قراءة كتاب PDF واستخراج الفهرس</h2>
      <p className="muted">يدعم PDF النصي والمصوّر. تُحفظ النصوص مع رقم صفحة PDF، وتُنشأ مرشحات أسماء للمراجعة فقط. لا يُرفع الملف إلى تخزين دائم؛ يُعالج مؤقتًا على الخادم ثم يُحذف.</p>
      <form onSubmit={submit}>
        <label htmlFor="genealogy-pdf-file">ملف الكتاب (PDF، حتى 20 ميغابايت)</label>
        <input id="genealogy-pdf-file" type="file" accept="application/pdf,.pdf" required disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
        {error && <p className="warning-note" role="alert">{error}</p>}
        {message && <p className="status-label" role="status">{message}</p>}
        {report && <div className="unknowns compact-unknowns">
          <strong>تقرير الاستخراج</strong>
          <p>صفحات PDF: {report.pdfPages} · مقاطع جديدة: {report.passagesCreated} · مقاطع مكررة: {report.passagesSkipped}</p>
          <p>مرشحات أسماء للمراجعة: {report.candidateSuggestionsCreated} · مرشحات مكررة: {report.candidateSuggestionsSkipped}</p>
          <p>المسار: {report.extractionModes.join("، ") || "لم يحدد"}</p>
        </div>}
        <button className="primary-button" type="submit" disabled={busy || !file}>{busy ? "جارٍ قراءة الكتاب… قد يستغرق عدة دقائق" : "استخراج النص وفهرس الأسماء"}</button>
      </form>
    </section>
  );
}
