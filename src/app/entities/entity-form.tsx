export default function EntityForm() {
  return (
    <section className="entity-form" aria-labelledby="entity-form-heading">
      <h2 id="entity-form-heading">إضافة كيان بحثي</h2>
      <p className="muted">
        الإضافة متوقفة مؤقتًا. الكتالوج الحالي مشترك بين مساحات العمل، ولم تُعتمد بعد سياسة
        مراجعة تمنع إدخال معلومات خاصة أو غير موثقة إلى السجل العام.
      </p>
      <div className="warning-note" role="status">
        لم يتم حفظ أي بيانات. سيُعاد تفعيل الإضافة بعد اعتماد صلاحيات المراجعة واختبارها.
      </div>
    </section>
  );
}
