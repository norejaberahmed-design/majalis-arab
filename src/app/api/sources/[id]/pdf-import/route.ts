import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";

export const runtime = "nodejs";
export const maxDuration = 300;
const execFileAsync = promisify(execFile);
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function parseTsv(input: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "\t" && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((value, index) => index === 0 ? value.replace(/^\uFEFF/, "") : value);
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export async function POST(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  let tempDir: string | undefined;
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "رفع الكتب متاح لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }

    const { id: sourceId } = await route.params;
    if (!sourceId || sourceId.length > 64) return NextResponse.json({ error: "معرّف المصدر غير صالح" }, { status: 400, headers: NO_STORE });
    const source = await prisma.source.findUnique({ where: { id: sourceId }, select: { id: true, title: true, author: true, edition: true, url: true } });
    if (!source) return NextResponse.json({ error: "المصدر غير موجود" }, { status: 404, headers: NO_STORE });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "اختر ملف PDF أولًا" }, { status: 400, headers: NO_STORE });
    if (!file.name.toLowerCase().endsWith(".pdf") || file.size < 8 || file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "يجب أن يكون الملف PDF وحجمه لا يتجاوز 20 ميغابايت" }, { status: 400, headers: NO_STORE });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return NextResponse.json({ error: "محتوى الملف لا يبدو ملف PDF صالحًا" }, { status: 400, headers: NO_STORE });

    tempDir = await mkdtemp(path.join(tmpdir(), "majalis-pdf-"));
    const pdfPath = path.join(tempDir, "source.pdf");
    const outputDir = path.join(tempDir, "output");
    await writeFile(pdfPath, bytes, { mode: 0o600 });
    const scriptPath = path.join(process.cwd(), "scripts", "extract_arabic_genealogy_candidates.py");
    try {
      await execFileAsync(process.env.PYTHON_BIN || "python3", [
        scriptPath, pdfPath, "--title", source.title,
        "--url", source.url || "", "--author", source.author || "",
        "--edition", source.edition || "", "--out", outputDir
      ], { timeout: 240_000, maxBuffer: 2 * 1024 * 1024 });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      console.error("PDF extraction failed", detail);
      await prisma.source.update({ where: { id: sourceId }, data: { extractionStatus: "FAILED" } });
      return NextResponse.json({
        error: "تعذر استخراج الكتاب. تأكد أن بيئة الخادم تحتوي Python 3 وPoppler (pdftotext/pdfinfo/pdftoppm) وTesseract مع اللغة العربية ara.",
        hint: "لم يتم اعتماد أي أنساب. يمكنك تشغيل scripts/extract_arabic_genealogy_candidates.py محليًا إذا لم تتوفر أدوات OCR على الاستضافة."
      }, { status: 503, headers: NO_STORE });
    }

    const passageRows = parseTsv(await readFile(path.join(outputDir, "page-passages.tsv"), "utf8"));
    const candidateRows = parseTsv(await readFile(path.join(outputDir, "tribe-candidates.tsv"), "utf8"));
    const qualityRows = parseTsv(await readFile(path.join(outputDir, "page-quality.tsv"), "utf8"));
    if (!passageRows.length && !qualityRows.length) {
      await prisma.source.update({ where: { id: sourceId }, data: { extractionStatus: "FAILED" } });
      return NextResponse.json({ error: "لم ينتج الاستخراج أي نص قابل للحفظ؛ راجع ملف PDF وجودة الصفحات." }, { status: 422, headers: NO_STORE });
    }

    let passagesCreated = 0, passagesSkipped = 0, suggestionsCreated = 0, suggestionsSkipped = 0;
    for (let offset = 0; offset < passageRows.length; offset += 25) {
      const batch = passageRows.slice(offset, offset + 25);
      await prisma.$transaction(async tx => {
        for (const row of batch) {
          const pageLabel = row.pageLabel?.trim();
          const passageText = row.passageText?.trim();
          if (!pageLabel || !passageText || passageText.length < 10) continue;
          const duplicate = await tx.evidencePassage.findFirst({ where: { sourceId, pageLabel, passageText }, select: { id: true } });
          if (duplicate) { passagesSkipped += 1; continue; }
          await tx.evidencePassage.create({
            data: { sourceId, pageLabel, passageText, locator: row.locator || "استخراج آلي من PDF؛ رقم صفحة PDF وقد يختلف عن ترقيم الكتاب المطبوع", reviewedByHuman: false }
          });
          passagesCreated += 1;
        }
      });
    }

    for (const row of candidateRows) {
      const name = row.candidateName?.trim(), pageLabel = row.pageLabel?.trim(), quote = row.evidenceExcerpt?.trim();
      if (!name || !pageLabel || !quote) continue;
      const passage = await prisma.evidencePassage.findFirst({
        where: { sourceId, pageLabel, passageText: { contains: quote.slice(0, 120) } },
        select: { id: true }
      });
      if (!passage) continue;
      const statement = `مرشح اسم قبلي يحتاج إلى مراجعة: «${name}» (صفحة PDF ${pageLabel})`;
      const prior = await prisma.researchSuggestion.findFirst({
        where: { workspaceId: context.workspaceId, passageId: passage.id, statement }, select: { id: true }
      });
      if (prior) { suggestionsSkipped += 1; continue; }
      await prisma.researchSuggestion.create({
        data: { workspaceId: context.workspaceId, sourceId, passageId: passage.id, statement, evidenceQuote: quote, status: "PENDING" }
      });
      suggestionsCreated += 1;
    }

    const modes = [...new Set(qualityRows.map(row => row.extractionMode).filter(Boolean))];
    await prisma.$transaction(async tx => {
      await tx.source.update({ where: { id: sourceId }, data: { extractionStatus: "EXTRACTED" } });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId, actorUserId: context.user.id, actor: context.user.email,
          action: "CATALOGUE_PDF_EXTRACTED", targetType: "Source", targetId: sourceId,
          details: JSON.stringify({ fileName: file.name.slice(0, 200), pdfPages: qualityRows.length, passagesCreated, passagesSkipped, suggestionsCreated, extractionModes: modes, allUnreviewed: true })
        }
      });
    });
    return NextResponse.json({
      data: { pdfPages: qualityRows.length, passagesCreated, passagesSkipped, candidateSuggestionsCreated: suggestionsCreated, candidateSuggestionsSkipped: suggestionsSkipped, extractionModes: modes },
      message: "اكتمل استخراج النص. جميع المقاطع ومرشحات الأسماء غير مراجعة، ولم تُنشأ أنساب أو علاقات مؤكدة."
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("PDF ingestion failed", error);
    return NextResponse.json({ error: "تعذرت معالجة ملف PDF. لم يمكن تأكيد اكتمال العملية." }, { status: 503, headers: NO_STORE });
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
