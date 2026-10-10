import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const passageSchema = z.object({
  pageLabel: z.string().trim().min(1).max(120),
  text: z.string().trim().min(10).max(5000),
  locator: z.string().trim().max(500).optional().default("")
});

const sourceSchema = z.object({
  title: z.string().trim().min(2).max(300),
  author: z.string().trim().max(200).optional().default(""),
  publisher: z.string().trim().max(200).optional().default(""),
  publicationYear: z.number().int().min(1).max(2100).nullable().optional(),
  edition: z.string().trim().max(200).optional().default(""),
  url: z.string().trim().url().max(2048).optional().default(""),
  accessNote: z.string().trim().min(5).max(2000),
  passages: z.array(passageSchema).min(1).max(500)
}).superRefine((source, ctx) => {
  if (source.url) {
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        ctx.addIssue({ code: "custom", path: ["url"], message: "Only HTTP(S) source URLs are accepted." });
      }
      if (url.username || url.password) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "URLs must not contain embedded credentials." });
      }
    } catch {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Invalid source URL." });
    }
  }
});

const manifestSchema = z.object({
  sources: z.array(sourceSchema).min(1).max(50)
});

export function normalizeArabicName(value) {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateManifest(value) {
  const parsed = manifestSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map(issue => ({
      path: issue.path.join("."),
      message: issue.message
    })) };
  }
  return { ok: true, data: parsed.data };
}

async function importManifest(manifest, workspaceId) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true }
  });
  if (!workspace) throw new Error("Workspace not found; provide an existing --workspace-id.");

  const report = {
    sourcesAttempted: manifest.sources.length,
    sourcesCreated: 0,
    sourcesReused: 0,
    passagesProcessed: 0,
    passagesCreated: 0,
    duplicatesSkipped: 0,
    errors: []
  };

  for (const input of manifest.sources) {
    try {
      const sourceWhere = input.url
        ? { title: input.title, url: input.url }
        : { title: input.title, url: null };
      let source = await prisma.source.findFirst({
        where: sourceWhere,
        select: { id: true }
      });

      if (!source) {
        source = await prisma.source.create({
          data: {
            title: input.title,
            author: input.author || null,
            publisher: input.publisher || null,
            publicationYear: input.publicationYear ?? null,
            edition: input.edition || null,
            url: input.url || null,
            bibliographicNote: input.accessNote,
            accessStatus: "NOT_CHECKED",
            extractionStatus: "NOT_ATTEMPTED",
            humanReviewed: false
          },
          select: { id: true }
        });
        report.sourcesCreated += 1;
      } else {
        report.sourcesReused += 1;
      }

      for (const passage of input.passages) {
        report.passagesProcessed += 1;
        const existing = await prisma.evidencePassage.findFirst({
          where: {
            sourceId: source.id,
            pageLabel: passage.pageLabel,
            passageText: passage.text
          },
          select: { id: true }
        });
        if (existing) {
          report.duplicatesSkipped += 1;
          continue;
        }

        const created = await prisma.$transaction(async tx => {
          const evidence = await tx.evidencePassage.create({
            data: {
              sourceId: source.id,
              pageLabel: passage.pageLabel,
              passageText: passage.text,
              locator: passage.locator || input.url || null,
              reviewedByHuman: false
            },
            select: { id: true }
          });
          await tx.auditLog.create({
            data: {
              workspaceId,
              actor: "source-batch-import",
              action: "CATALOGUE_EVIDENCE_PASSAGE_IMPORTED",
              targetType: "EvidencePassage",
              targetId: evidence.id,
              details: JSON.stringify({
                sourceId: source.id,
                pageLabel: passage.pageLabel,
                reviewedByHuman: false,
                importMethod: "JSON_BATCH"
              })
            }
          });
          return evidence;
        });
        if (created) report.passagesCreated += 1;
      }

      if (input.passages.length > 0) {
        await prisma.source.update({
          where: { id: source.id },
          data: { extractionStatus: "EXTRACTED", humanReviewed: false }
        });
      }
    } catch (error) {
      report.errors.push({
        source: input.title,
        message: error instanceof Error ? error.message : "Unknown import error"
      });
    }
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const workspaceIndex = args.indexOf("--workspace-id");
  if (fileIndex < 0 || !args[fileIndex + 1] || workspaceIndex < 0 || !args[workspaceIndex + 1]) {
    process.stderr.write("Usage: node scripts/import-source-batch.mjs --file <manifest.json> --workspace-id <existing-workspace-id>\n");
    process.exitCode = 2;
    return;
  }

  const filePath = args[fileIndex + 1];
  const workspaceId = args[workspaceIndex + 1];
  const raw = JSON.parse(await readFile(filePath, "utf8"));
  const validated = validateManifest(raw);
  if (!validated.ok) {
    process.stderr.write(JSON.stringify({ error: "Invalid source manifest", details: validated.errors }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }

  const report = await importManifest(validated.data, workspaceId);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (report.errors.length) process.exitCode = 1;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main()
    .catch(error => {
      process.stderr.write((error instanceof Error ? error.message : "Import failed") + "\n");
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
