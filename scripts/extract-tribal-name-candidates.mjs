import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// These are conservative text patterns, not a classifier of lineage or proof of tribal identity.
const NAME_PATTERNS = [
  /(?:قبيلة|قبائل|بطن|بطون|فخذ|أفخاذ|عشيرة|عشائر)\s+([\u0621-\u064A]{2,}(?:\s+(?:بن|ابن|بني|آل|ال)\s+[\u0621-\u064A]{2,}){0,3})/gu,
  /(?:بنو|بني|آل)\s+([\u0621-\u064A]{2,}(?:\s+(?:بن|ابن|بني|آل)\s+[\u0621-\u064A]{2,}){0,2})/gu
];

export function normalizeArabicName(value) {
  return value.normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceAround(text, index, length) {
  const left = Math.max(text.lastIndexOf("。", index), text.lastIndexOf(".", index), text.lastIndexOf("؟", index), text.lastIndexOf("!", index), text.lastIndexOf("؛", index), text.lastIndexOf("\n", index)) + 1;
  const stops = [text.indexOf("۔", index + length), text.indexOf(".", index + length), text.indexOf("؟", index + length), text.indexOf("!", index + length), text.indexOf("؛", index + length), text.indexOf("\n", index + length)].filter(position => position >= 0);
  const right = stops.length ? Math.min(...stops) : text.length;
  return text.slice(left, right).trim();
}

export function extractNameCandidates(text) {
  const found = new Map();
  for (const pattern of NAME_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const name = (match[1] || "").trim().replace(/[،؛:,.]+$/u, "");
      if (name.length < 2) continue;
      const normalized = normalizeArabicName(name);
      if (!normalized) continue;
      const start = match.index ?? 0;
      const quote = sentenceAround(text, start, match[0].length);
      const prior = found.get(normalized);
      if (!prior || quote.length > prior.quote.length) found.set(normalized, { name, quote: quote || match[0] });
    }
  }
  return [...found.values()];
}

async function main() {
  const args = process.argv.slice(2);
  const workspaceIndex = args.indexOf("--workspace-id");
  const limitIndex = args.indexOf("--limit");
  const offsetIndex = args.indexOf("--offset");
  if (workspaceIndex < 0 || !args[workspaceIndex + 1]) {
    process.stderr.write("Usage: node scripts/extract-tribal-name-candidates.mjs --workspace-id <existing-workspace-id> [--limit 500] [--offset 0]\n");
    process.exitCode = 2;
    return;
  }

  const workspaceId = args[workspaceIndex + 1];
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 500;
  const offset = offsetIndex >= 0 ? Number(args[offsetIndex + 1]) : 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
    process.stderr.write("--limit must be an integer from 1 to 10000.\n");
    process.exitCode = 2;
    return;
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    process.stderr.write("--offset must be a non-negative safe integer.\n");
    process.exitCode = 2;
    return;
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) throw new Error("Workspace not found; provide an existing --workspace-id.");

  const totalPassages = await prisma.evidencePassage.count();
  const passages = await prisma.evidencePassage.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: offset,
    take: limit,
    select: { id: true, sourceId: true, pageLabel: true, passageText: true }
  });
  const nextOffset = offset + passages.length;
  const report = {
    totalPassages,
    offset,
    passagesScanned: passages.length,
    nextOffset,
    hasMore: nextOffset < totalPassages,
    candidatesFound: 0,
    suggestionsCreated: 0,
    duplicatesSkipped: 0
  };
  for (const passage of passages) {
    for (const candidate of extractNameCandidates(passage.passageText)) {
      report.candidatesFound += 1;
      const statement = `مرشح اسم قبلي يحتاج إلى مراجعة: «${candidate.name}»`;
      const existing = await prisma.researchSuggestion.findFirst({
        where: { workspaceId, passageId: passage.id, statement },
        select: { id: true }
      });
      if (existing) {
        report.duplicatesSkipped += 1;
        continue;
      }
      await prisma.researchSuggestion.create({
        data: {
          workspaceId,
          sourceId: passage.sourceId,
          passageId: passage.id,
          statement,
          evidenceQuote: candidate.quote,
          status: "PENDING"
        }
      });
      report.suggestionsCreated += 1;
    }
  }
  process.stdout.write(JSON.stringify({
    ...report,
    warning: "Text-pattern candidates only. No tribal entity, genealogy, relationship, or historical claim was created."
  }, null, 2) + "\n");
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(error => {
    process.stderr.write((error instanceof Error ? error.message : "Candidate extraction failed") + "\n");
    process.exitCode = 1;
  }).finally(async () => prisma.$disconnect());
}
