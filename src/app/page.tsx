import Link from "next/link";

const SECTIONS = [
  { href: "/search?type=TRIBE", label: "القبائل", icon: "🏛", desc: "استكشف القبائل العربية" },
  { href: "/search?type=FAMILY", label: "العائلات", icon: "🏘", desc: "العائلات وفروعها" },
  { href: "/search?type=PERSON", label: "الشخصيات", icon: "👤", desc: "الشخصيات التاريخية والمعاصرة" },
  { href: "/search?type=SOURCE", label: "المصادر", icon: "📚", desc: "الكتب والوثائق والروايات" },
  { href: "#", label: "المجالس", icon: "💬", desc: "المجالس والنقاشات", disabled: true },
];

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      {/* البحث المحوري */}
      <section className="text-center space-y-4 pt-4">
        <h1 className="text-2xl md:text-3xl font-bold text-brand-800">
          مجالس عرب
        </h1>
        <p className="text-brand-500 text-sm md:text-base">
          منصة معرفية عربية للقبائل والعائلات والشخصيات والمصادر والروايات
        </p>
        <form action="/search" className="max-w-2xl mx-auto">
          <input
            type="text"
            name="q"
            placeholder="ابحث عن قبيلة، عائلة، شخصية، مصدر، أو موضوع..."
            className="input-field text-center text-base py-3.5"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary mt-3 w-full md:w-auto md:px-8">
            بحث
          </button>
        </form>
      </section>

      {/* الأقسام */}
      <section className="space-y-4">
        <h2 className="section-title">الأقسام</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SECTIONS.map((s) => (
            <div key={s.label}>
              {s.disabled ? (
                <div className="card opacity-50 cursor-not-allowed text-center space-y-1">
                  <span className="text-2xl">{s.icon}</span>
                  <div className="font-medium text-brand-700">{s.label}</div>
                  <div className="text-xs text-brand-400">{s.desc}</div>
                  <div className="text-xs text-brand-300">قريبًا</div>
                </div>
              ) : (
                <Link href={s.href} className="card hover:border-brand-300 hover:shadow-md transition-all text-center space-y-1 block">
                  <span className="text-2xl">{s.icon}</span>
                  <div className="font-medium text-brand-700">{s.label}</div>
                  <div className="text-xs text-brand-400">{s.desc}</div>
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* استكشف — المحتوى المعتمد فقط */}
      <section className="space-y-4">
        <h2 className="section-title">استكشف</h2>
        <div className="card text-center py-8 text-brand-400">
          <p className="text-sm">
            المحتوى المعتمد يظهر هنا بعد المراجعة
          </p>
          <p className="text-xs mt-1 text-brand-300">
            لا تعرض المنصة بيانات غير موثقة كأنها حقيقة
          </p>
        </div>
      </section>

      {/* عن المنصة */}
      <section className="card space-y-2">
        <h2 className="section-title">عن المنصة</h2>
        <p className="text-sm text-brand-600 leading-relaxed">
          مجالس عرب منصة معرفية تحترم المصادر وتفرّق بين الحقيقة الموثقة والمعلومة من مصدر واحد والرواية الشعبية والرواية المتعارضة. لا تدّعي امتلاك الحقيقة المطلقة، بل تعرض المعلومة ومصدرها ودليلها ودرجة قوة الأدلة.
        </p>
      </section>
    </div>
  );
}
