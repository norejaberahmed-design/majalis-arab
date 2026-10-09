"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccessStatus = "NOT_CHECKED" | "OPEN_ACCESS" | "RESTRICTED" | "UNAVAILABLE";
type ExtractionStatus = "NOT_ATTEMPTED" | "EXTRACTED" | "OCR_REQUIRED" | "FAILED";

export default function SourceReviewActions({ sourceId, accessStatus, extractionStatus, humanReviewed }: {
  sourceId: string;
  accessStatus: AccessStatus;
  extractionStatus: ExtractionStatus;
  humanReviewed: boolean;
}) {
  const router = useRouter();
  const [access, setAccess] = useState<Exclude<AccessStatus, "NOT_CHECKED">>(accessStatus === "NOT_CHECKED" ? "OPEN_ACCESS" : accessStatus);
  const [extraction, setExtraction] = useState<ExtractionStatus>(extractionStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/curation/sources/${encodeURIComponent(sourceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessStatus: access, extractionStatus: extraction })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذرت مراجعة المصدر");
      setMessage(result.message || "تمت مراجعة المصدر.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">أدوات أمين الكتالوج</p>
      <h2>مراجعة بيانات المصدر</h2>
      <p className="muted">تأكيد هذه البيانات يسجل أن أمين الكتالوج فحص المرجع. لا يثبت وحده صحة أي ادعاء تاريخي.</p>
      <div className="member-add-row">
        <label>حالة الإتاحة
          <select value={access} onChange={event => setAccess(event.target.value as typeof access)}>
            <option value="OPEN_ACCESS">إتاحة مفتوحة</option>
            <option value="RESTRICTED">مقيّد</option>
            <option value="UNAVAILABLE">غير متاح</option>
          </select>
        </label>
        <label>حالة النص
          <select value={extraction} onChange={event => setExtraction(event.target.value as ExtractionStatus)}>
            <option value="NOT_ATTEMPTED">لم يُستخرج</option>
            <option value="EXTRACTED">تم استخراج النص</option>
            <option value="OCR_REQUIRED">يتطلب OCR</option>
            <option value="FAILED">فشل الاستخراج</option>
          </select>
        </label>
        <button type="button" className="primary-button" disabled={busy} onClick={submit}>{busy ? "جارٍ الحفظ…" : humanReviewed ? "تحديث المراجعة" : "تأكيد مراجعة المصدر"}</button>
      </div>
      {message && <p className="form-message" role="status">{message}</p>}
    </section>
  );
}
