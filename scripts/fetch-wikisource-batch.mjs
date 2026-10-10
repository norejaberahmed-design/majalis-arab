import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseWikisourcePageUrl } from "./fetch-wikisource-text.mjs";

const MAX_PAGES = 25;

export function validateWikisourceBatch(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.pages)) {
    throw new Error('صيغة الملف غير صحيحة؛ المطلوب {"pages":[{"url":"..."}]}.');
  }
  if (value.pages.length < 1 || value.pages.length > MAX_PAGES) {
    throw new Error(`يجب أن تحتوي الدفعة على صفحة واحدة إلى ${MAX_PAGES} صفحة.`);
  }

  const seen = new Set();
  const pages = value.pages.map((entry, index) => {
    if (!entry || typeof entry.url !== "string") {
      throw new Error(`الرابط مفقود في العنصر رقم ${index + 1}.`);
    }
    const parsed = parseWikisourcePageUrl(entry.url);
    if (seen.has(parsed.url)) throw new Error(`الرابط مكرر في الدفعة: ${parsed.url}`);
    seen.add(parsed.url);
    return { url: parsed.url, title: parsed.title };
  });

  return { pages };
}

function runPage(scriptPath, url, workspaceId) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [
      scriptPath, "--url", url, "--workspace-id", workspaceId
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => resolve({ ok: false, url, error: error.message }));
    child.on("close", code => {
      let result = null;
      try { result = stdout.trim() ? JSON.parse(stdout) : null; } catch { /* retain raw output below */ }
      resolve(code === 0
        ? { ok: true, url, result }
        : { ok: false, url, exitCode: code, error: stderr.trim() || stdout.trim() || "فشل جلب الصفحة." });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const workspaceIndex = args.indexOf("--workspace-id");
  if (fileIndex < 0 || !args[fileIndex + 1] || workspaceIndex < 0 || !args[workspaceIndex + 1]) {
    process.stderr.write("Usage: npm run db:fetch-wikisource-batch -- --file ./pages.json --workspace-id EXISTING_WORKSPACE_ID\n");
    process.exitCode = 2;
    return;
  }

  const manifest = validateWikisourceBatch(JSON.parse(await readFile(args[fileIndex + 1], "utf8")));
  const workspaceId = args[workspaceIndex + 1];
  const scriptPath = fileURLToPath(new URL("./fetch-wikisource-text.mjs", import.meta.url));
  const results = [];

  // Sequential execution avoids bursts against Wikisource and keeps DB writes isolated per page.
  for (const page of manifest.pages) {
    results.push(await runPage(scriptPath, page.url, workspaceId));
  }

  const report = {
    pagesRequested: manifest.pages.length,
    pagesSucceeded: results.filter(item => item.ok).length,
    pagesFailed: results.filter(item => !item.ok).length,
    results,
    warning: "كل نتيجة ناجحة تعني جلب نص صفحة ويب فقط؛ لا تثبت اكتمال الكتاب أو صحة النسب. راجع النص والطبعة والحقوق يدويًا."
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (report.pagesFailed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    process.stderr.write((error instanceof Error ? error.message : "فشل استيراد الدفعة") + "\n");
    process.exitCode = 1;
  });
}
