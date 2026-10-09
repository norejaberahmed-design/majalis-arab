"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";

type SourceRow = {
  title: string;
  author: string;
  publisher: string;
  publicationYear: number | null;
  url: string;
  bibliographicNote: string;
};

function parseCsv(text: string): { rows: SourceRow[]; error?: string } {
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some(value => value.trim())) matrix.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (quoted) return { rows: [], error: "يوجد حقل CSV بعلامات اقتباس غير مكتملة." };
  row.push(field);
  if (row.some(value => value.trim())) matrix.push(row);
  if (matrix.length < 2) return { rows: [], error: "الملف يجب أن يحتوي على صف عناوين وصف مصدر واحد على الأقل." };

  const headers = matrix.shift()!.map((value, index) => value.replace(index === 0 ? /^\uFEFF/ : /$^/, "").trim().toLowerCase());
  const indexOf = (...names: string[]) => headers.findIndex(header => names.includes(header));
  const titleIndex = indexOf("title", "العنوان", "source title");
  if (titleIndex < 0) return { rows: [], error: "أضف عمودًا باسم title أو العنوان." };
  const authorIndex = indexOf("author", "المؤلف");
  const publisherIndex = indexOf("publisher", "الناشر");
  const yearIndex = indexOf("publicationyear", "year", "سنة النشر");
  const urlIndex = indexOf("url", "الرابط");
  const noteIndex = indexOf("bibliographicnote", "note", "ملاحظات");

  const rows: SourceRow[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const values = matrix[i];
    const valueAt = (index: number) => index >= 0 ? (values[index] ?? "").trim() : "";
    const title = valueAt(titleIndex);
    if (!title) return { rows: [], error: "عنوان المصدر مفقود في الصف " + (i + 2) + "." };
    const yearText = valueAt(yearIndex);
    const year = yearText ? Number(yearText) : null;
    if (yearText && (!Number.isInteger(year) || (year as number) < 1 || (year as number) > 2100)) {
      return { rows: [], error: "سنة النشر غير صالحة في الصف " + (i + 2) + "." };
    }
    rows.push({
      title,
      author: valueAt(authorIndex),
      publisher: valueAt(publisherIndex),
      publicationYear: year,
      url: valueAt(urlIndex),
      bibliographicNote: valueAt(noteIndex)
    });
  }
  if (rows.length > 100) return { rows: [], error: "الحد الأقصى 100 مصدر في الملف الواحد." };
  return { rows };
}

export default function SourceCsvImportForm() {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setRows([]);
    setError("");
    setMessage("");
    setFileName("");
    if (!file) return;
    if (file.size > 1_000_000) {
      setError("حجم الملف يتجاوز 1 ميغابايت.");
      return;
    }
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      setFileName(file.name);
      setRows(parsed.rows);
    } catch {
      setError("تعذر قراءة ملف CSV.");
    }
  }

  async function importRows() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/sources/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: rows })
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "تعذر استيراد المصادر.");
        return;
      }
      setMessage(result.message || "اكتمل الاستيراد.");
      setRows([]);
      setFileName("");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخدمة؛ لم نتمكن من تأكيد الاستيراد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="entity-form">
      <h2>استيراد قائمة مراجع من CSV</h2>
      <p className="muted">الأعمدة: title, author, publisher, publicationYear, url, bibliographicNote. يدعم العناوين العربية. الاستيراد يسجل المراجع فقط ولا يثبت إتاحتها أو محتواها.</p>
      <label htmlFor="source-csv">ملف CSV (حتى 100 مصدر، 1 ميغابايت)</label>
      <input id="source-csv" type="file" accept=".csv,text/csv" onChange={chooseFile} />
      {fileName && <p className="muted">الملف: {fileName} · عدد الصفوف: {rows.length}</p>}
      {rows.length > 0 && <div className="panel list-panel">
        <div className="list-heading"><h3>معاينة قبل الاستيراد</h3><span className="count-pill">{rows.length}</span></div>
        <div className="entity-list">{rows.slice(0, 5).map((row, index) => (
          <article className="entity-row" key={index}>
            <div><strong>{row.title}</strong><small>{[row.author, row.publisher, row.publicationYear].filter(Boolean).join(" · ") || "بيانات إضافية غير مدخلة"}</small></div>
          </article>
        ))}</div>
        {rows.length > 5 && <p className="muted">تظهر أول خمسة صفوف للمعاينة فقط.</p>}
        <button className="primary-button" type="button" onClick={importRows} disabled={busy}>{busy ? "جارٍ الاستيراد…" : "استيراد " + rows.length + " مصدرًا"}</button>
      </div>}
      {error && <p className="warning-note" role="alert">{error}</p>}
      {message && <p className="status-label" role="status">{message}</p>}
    </section>
  );
}
