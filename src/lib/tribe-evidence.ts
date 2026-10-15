import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/validation";

const STOP_WORDS = new Set([
  "عن", "في", "من", "على", "الى", "إلى", "ما", "ماذا", "هل", "كيف", "متى",
  "اين", "أين", "هو", "هي", "هم", "هذا", "هذه", "ذلك", "تلك", "مع", "بين",
  "كل", "كان", "كانت", "يكون", "اريد", "أريد", "اعرف", "أعرف", "اشرح", "لخص",
  "قارن", "مصادر", "المصادر", "قبيلة", "قبيله", "تاريخ", "تاريخها", "عنها"
]);

function queryTerms(question: string): string[] {
  return [...new Set(
    question
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map(term => term.trim())
      .filter(term => term.length >= 3 && !STOP_WORDS.has(normalizeName(term)))
  )].slice(0, 5);
}

function formatSource(source: {
  title: string;
  author: string | null;
  publicationYear: number | null;
  url?: string | null;
}): string {
  return [
    source.title,
    source.author ? `المؤلف: ${source.author}` : null,
    source.publicationYear ? `السنة: ${source.publicationYear}` : null,
    source.url ? `الرابط: ${source.url}` : null
  ].filter(Boolean).join("؛ ");
}

/**
 * Retrieves only shared catalogue evidence and contributions belonging to the
 * workspace's explicitly linked tribe. WorkspaceEntityNote is intentionally
 * excluded because it is private to a workspace.
 */
export async function buildTribeEvidenceContext(workspaceId: string, question: string): Promise<string | undefined> {
  const terms = queryTerms(question);
  const linked = await prisma.workspaceTribe.findUnique({
    where: { workspaceId },
    select: { entity: { select: { id: true, name: true, kind: true, summary: true } } }
  });

  const matches = terms.length
    ? await prisma.tribalEntity.findMany({
        where: {
          kind: { in: ["TRIBE", "CLAN"] },
          OR: terms.flatMap(term => [
            { name: { contains: term } },
            { normalizedName: { contains: normalizeName(term) } },
            { summary: { contains: term } }
          ])
        },
        orderBy: { name: "asc" },
        take: 8,
        select: { id: true, name: true, kind: true, summary: true }
      })
    : [];

  // Use the linked tribe as a default only when the question did not identify
  // another catalogue entity. Never mix private workspace notes into AI context.
  const linkedNameInQuestion = linked
    ? normalizeName(question).includes(normalizeName(linked.entity.name))
    : false;
  const entities = [...matches];
  if (linked && (entities.some(entity => entity.id === linked.entity.id) || (entities.length === 0 || linkedNameInQuestion))) {
    if (!entities.some(entity => entity.id === linked.entity.id)) entities.unshift(linked.entity);
  }
  if (entities.length === 0) return undefined;

  const entityIds = entities.map(entity => entity.id);
  const [passages, claims, relationships, contributions] = await Promise.all([
    prisma.evidencePassage.findMany({
      where: { entityId: { in: entityIds } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        passageText: true, pageLabel: true, locator: true, reviewedByHuman: true,
        source: { select: { title: true, author: true, publicationYear: true, url: true, humanReviewed: true, accessStatus: true } },
        entity: { select: { name: true } }
      }
    }),
    prisma.historicalClaim.findMany({
      where: { entityId: { in: entityIds } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        statement: true, status: true, reviewedByHuman: true, confidenceNote: true,
        entity: { select: { name: true } },
        source: { select: { title: true, author: true, publicationYear: true, url: true } },
        supportingPassages: { take: 2, select: { pageLabel: true, locator: true, passageText: true, source: { select: { title: true } } } }
      }
    }),
    prisma.relationship.findMany({
      where: { OR: [{ fromEntityId: { in: entityIds } }, { toEntityId: { in: entityIds } }] },
      take: 12,
      select: {
        relationshipType: true, description: true,
        fromEntity: { select: { name: true } },
        toEntity: { select: { name: true } },
        claim: { select: { statement: true, status: true } }
      }
    }),
    linked && entities.some(entity => entity.id === linked.entity.id)
      ? prisma.tribeKnowledgeEntry.findMany({
          where: { entityId: linked.entity.id },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { content: true, sourceUrl: true, status: true, createdAt: true }
        })
      : Promise.resolve([])
  ]);

  const sections: string[] = [
    "بيانات الدليل القبلي والتاريخي الموجودة داخل قاعدة بيانات مجلس العرب. ليست كل معلومة مؤكدة؛ التزم بحالة المراجعة المذكورة.",
    "الكيانات المطابقة:",
    ...entities.map(entity => `- ${entity.name} [${entity.kind}]${entity.summary ? `: ${entity.summary}` : ""}`)
  ];

  if (claims.length) {
    sections.push("\nالادعاءات المسجلة (الحالة مهمة):");
    for (const claim of claims) {
      const source = claim.source ? formatSource(claim.source) : "لا يوجد مصدر ببليوغرافي مرتبط";
      sections.push(`- القبيلة/الكيان: ${claim.entity?.name ?? "غير محدد"}؛ الادعاء: ${claim.statement}؛ الحالة: ${claim.status}؛ مراجعة بشرية: ${claim.reviewedByHuman ? "نعم" : "لا"}؛ المصدر: ${source}`);
      for (const passage of claim.supportingPassages) {
        sections.push(`  مقتطف مساند [${passage.source.title}، ${passage.pageLabel || passage.locator || "موضع غير محدد"}]: ${passage.passageText.slice(0, 700)}`);
      }
    }
  }

  if (passages.length) {
    sections.push("\nمقاطع المصادر:");
    for (const passage of passages) {
      sections.push(`- الكيان: ${passage.entity?.name ?? "غير محدد"}؛ المصدر: ${formatSource(passage.source)}؛ حالة المصدر: ${passage.source.accessStatus}؛ مراجعة المصدر: ${passage.source.humanReviewed ? "نعم" : "لا"}؛ مراجعة المقطع: ${passage.reviewedByHuman ? "نعم" : "لا"}؛ الصفحة/الموضع: ${passage.pageLabel || passage.locator || "غير محدد"}؛ النص: ${passage.passageText.slice(0, 900)}`);
    }
  }

  if (relationships.length) {
    sections.push("\nالعلاقات المسجلة (لا تفترض أنها تثبت النسب إذا كانت غير موثقة):");
    for (const relation of relationships) {
      sections.push(`- ${relation.fromEntity.name} — ${relation.relationshipType} — ${relation.toEntity.name}${relation.description ? `; وصف: ${relation.description}` : ""}${relation.claim ? `; الادعاء المرتبط: ${relation.claim.statement} [${relation.claim.status}]` : ""}`);
    }
  }

  if (contributions.length) {
    sections.push("\nمساهمات أعضاء المجلس في ملف القبيلة المرتبط بهذا المجلس (غير موثقة ما لم تُراجع):");
    for (const entry of contributions) {
      sections.push(`- الحالة: ${entry.status}؛ التاريخ: ${entry.createdAt.toISOString().slice(0, 10)}؛ المصدر المقدم: ${entry.sourceUrl || "لم يقدم"}؛ النص: ${entry.content.slice(0, 700)}`);
    }
  }

  sections.push("\nتعليمات العرض: لا تحوّل الحالة UNREVIEWED/UNREVIEWED أو عدم المراجعة إلى حقيقة. اذكر اسم المصدر والصفحة متى توفرا، وافصل الرواية عن الحقيقة الموثقة. إذا لم تكفِ البيانات، قل إن قاعدة البيانات لا تحتوي دليلًا كافيًا؛ لا تدّعِ أنك بحثت في الإنترنت.");
  return sections.join("\n").slice(0, 12000);
}
