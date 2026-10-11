import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const bibliography = [
  {
    title: "نسب معد واليمن الكبير",
    author: "هشام بن محمد بن السائب الكلبي (ابن الكلبي)",
    publisher: "عالم الكتب؛ مكتبة النهضة العربية",
    publicationYear: 1988,
    url: "https://ketabonline.com/ar/books/3480",
    bibliographicNote: "بيانات ببليوغرافية منشورة في فهرس جامع الكتب الإسلامية: تحقيق ناجي حسن، الطبعة الأولى، 1408هـ/1988م، مجلدان في ترقيم مسلسل واحد، 719 صفحة. سجل مرجعي فقط؛ لم يُسجل أي ادعاء تاريخي منه. رابط الفهرس تحقق منه في 2026-10-09."
  },
  {
    title: "صفة جزيرة العرب",
    author: "الحسن بن أحمد الهمداني",
    publisher: "مطبعة بريل، ليدن",
    publicationYear: 1884,
    url: "https://ketabonline.com/ar/books/1355",
    bibliographicNote: "فهرس جامع الكتب الإسلامية يذكر طبعة مطبعة بريل، ليدن، 1884م، وينسب الكتاب إلى الهمداني المتوفى سنة 334هـ. سجل ببليوغرافي فقط؛ حالة الإتاحة القانونية والنص الكامل لم تراجع بعد. رابط الفهرس تحقق منه في 2026-10-09."
  },
  {
    title: "أنساب الأشراف",
    author: "أحمد بن يحيى البلاذري",
    publisher: "المستودع الرقمي لمكتبة قطر الوطنية",
    publicationYear: null,
    url: "https://ediscovery.qnl.qa/ar/islandora/search?f%5B0%5D=dc.subject%3A%D8%A7%D9%84%D9%82%D8%A8%D8%A7%D8%A6%D9%84+%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9&islandora_solr_search_navigation=0",
    bibliographicNote: "ظهر العنوان والمؤلف في نتائج فهرس مكتبة قطر الوطنية تحت موضوع الأنساب العربية والقبائل العربية؛ توجد سجلات لأجزاء وطبعات متعددة، لذلك لم تُحدد طبعة واحدة أو سنة نشر. يلزم اختيار سجل المجلد المقصود قبل الاستشهاد بصفحة. رابط الفهرس تحقق منه في 2026-10-09."
  },
  {
    title: "اللباب في تهذيب الأنساب",
    author: "عز الدين علي بن محمد ابن الأثير",
    publisher: "المستودع الرقمي لمكتبة قطر الوطنية",
    publicationYear: 1937,
    url: "https://ediscovery.qnl.qa/ar/islandora/search?f%5B0%5D=dc.subject%3A%D8%A7%D9%84%D9%82%D8%A8%D8%A7%D8%A6%D9%84+%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9&f%5B1%5D=dc.date%3A%221938%22&islandora_solr_search_navigation=0",
    bibliographicNote: "نتائج فهرس مكتبة قطر الوطنية تعرض العنوان والمؤلف وبيانات مجلدات، منها سجل مفهرس تحت تاريخ 1937/1938. السنة هنا تقريبية مستندة إلى بيانات الفهرس، وتحتاج مطابقة مع صفحة عنوان النسخة قبل اعتمادها للاستشهاد. لم يُسجل أي ادعاء تاريخي من هذا المرجع."
  }
,
  {
    title: "معجم قبائل العرب القديمة والحديثة — الجزء الأول",
    author: "عمر رضا كحالة",
    publisher: "Arabic Collections Online / NYU Libraries",
    publicationYear: null,
    url: "https://sites.dlib.nyu.edu/viewer/books/aub_aco003047/display?lang=ar",
    bibliographicNote: "سجل ببليوغرافي لنسخة رقمية من الجزء الأول. لم يُتحقق من الطبعة والترقيم المطبوع أو شروط إعادة نشر النص، ولم يُستخرج النص الكامل. يلزم مراجعة صفحة العنوان قبل اعتماد الاستشهاد."
  },
  {
    title: "معجم قبائل العرب القديمة والحديثة — الجزء الثاني",
    author: "عمر رضا كحالة",
    publisher: "Arabic Collections Online / NYU Libraries",
    publicationYear: null,
    url: "https://sites.dlib.nyu.edu/viewer/books/aub_aco003048/display?lang=ar",
    bibliographicNote: "سجل ببليوغرافي مستقل للجزء الثاني. لا تفترض مطابقة الترقيم مع الجزء الأول؛ لم يُتحقق من الطبعة أو شروط إعادة نشر النص، ولم يُستخرج النص الكامل."
  },
  {
    title: "معجم قبائل المملكة العربية السعودية",
    author: "حمد الجاسر",
    publisher: "نسخة PDF مفهرسة على موقع إسلام واي",
    publicationYear: null,
    url: "https://books.islamway.net/1/525_aljasir_mejmqabyil.pdf",
    bibliographicNote: "رابط نسخة PDF مرجعية يحتاج فحصًا مباشرًا لصفحة العنوان والطبعة وحقوق الاستخدام قبل الاستخراج أو إعادة نشر النص. لم يُقرأ الكتاب كاملًا ولم تُستخرج منه أسماء في هذا السجل."
  },
  {
    title: "سبائك الذهب في معرفة قبائل العرب",
    author: "محمد أمين البغدادي السويدي؛ أحمد بن علي القلقشندي (بحسب فهرس NYU)",
    publisher: "المكتبة العلمية، قم (بحسب فهرس NYU)",
    publicationYear: null,
    url: "https://sites.dlib.nyu.edu/viewer/books/nyu_aco001225/1?embed=1&lang=ar",
    bibliographicNote: "سجل ببليوغرافي أولي اعتمادًا على فهرس Arabic Collections Online بجامعة نيويورك؛ بيانات سنة النشر غير محسومة في الفهرس. تجربة OCR للنسخة المصورة عالية الدقة (128 صفحة PDF) أعطت 138 مرشح اسم، منها 105 منخفضة الجودة و33 متوسطة، وصُنفت 99 صفحة من 128 منخفضة الوضوح آليًا. لم تُعتمد أي أسماء أو أنساب من هذه التجربة؛ يلزم فحص الصور صفحةً صفحة قبل إدخال أي مرشح في الدليل. فهرس NYU يذكر أن المواد المعروضة ضمن الملكية العامة بحسب تقديره، ويجب مراجعة شروط المصدر قبل إعادة نشر النص."
  }

];

async function main() {
  let created = 0;
  let existing = 0;

  for (const item of bibliography) {
    const match = await prisma.source.findFirst({
      where: { title: item.title, url: item.url },
      select: { id: true }
    });

    if (match) {
      existing += 1;
      continue;
    }

    await prisma.source.create({
      data: {
        ...item,
        accessStatus: "NOT_CHECKED",
        extractionStatus: "NOT_ATTEMPTED",
        humanReviewed: false
      }
    });
    created += 1;
  }

  process.stdout.write(JSON.stringify({
    created,
    existing,
    totalCatalogued: bibliography.length,
    note: "Bibliographic catalogue records only; no tribal claims, entities, or genealogies were seeded."
  }, null, 2) + "\n");
}

main()
  .catch(error => {
    console.error("Bibliography import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
