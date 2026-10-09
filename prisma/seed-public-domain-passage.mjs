import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sourceRecord = {
  title: "صفة جزيرة العرب — ويكي مصدر، الجزء الأول",
  author: "الحسن بن أحمد الهمداني",
  publisher: "ويكي مصدر",
  url: "https://ar.wikisource.org/wiki/صفة_جزيرة_العرب/الجزء_الأول",
  bibliographicNote:
    "نسخة نصية إلكترونية مفتوحة للقراءة. المقطع المسجل أدناه من فقرة تقسيم جزيرة العرب في النص الإلكتروني، ولم تُطابق عبارته بعد مع صورة صفحة محددة من طبعة مطبوعة. يُحفظ بوصفه نصًا منسوبًا إلى المصدر لا بوصفه حقيقة تاريخية مثبتة. راجع أيضًا ملف المسح الضوئي لطبعة ليدن 1884: https://ar.wikisource.org/wiki/ملف:صفة_جزيرة_العرب.pdf"
};

const passageText =
  "فصارت بلاد العرب من هذه الجزيرة التي نزلوا بها وتدالدوا فيها على خمسة أقسام عند العرب وفي أشعارها: تهامة والحجاز ونجد والعروض واليمن";

async function main() {
  let source = await prisma.source.findFirst({
    where: { title: sourceRecord.title, url: sourceRecord.url },
    select: { id: true }
  });

  let sourceCreated = false;
  if (!source) {
    source = await prisma.source.create({
      data: {
        ...sourceRecord,
        accessStatus: "NOT_CHECKED",
        extractionStatus: "NOT_ATTEMPTED",
        humanReviewed: false
      },
      select: { id: true }
    });
    sourceCreated = true;
  }

  const existingPassage = await prisma.evidencePassage.findFirst({
    where: { sourceId: source.id, passageText },
    select: { id: true }
  });

  let passageCreated = false;
  if (!existingPassage) {
    await prisma.evidencePassage.create({
      data: {
        sourceId: source.id,
        pageLabel: "الجزء الأول؛ فقرة تقسيم جزيرة العرب (موضع نصي، لا رقم صفحة مطبوعة)",
        locator: sourceRecord.url,
        passageText,
        reviewedByHuman: false
      }
    });
    passageCreated = true;
  }

  process.stdout.write(JSON.stringify({
    sourceCreated,
    passageCreated,
    note: "One attributed transcription passage only; no HistoricalClaim, TribalEntity, or genealogy was created."
  }, null, 2) + "\n");
}

main()
  .catch(error => {
    console.error("Public-domain passage import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
