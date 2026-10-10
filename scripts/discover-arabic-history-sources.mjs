const API = "https://ar.wikisource.org/w/api.php";
const DEFAULT_QUERIES = [
  "أنساب العرب",
  "قبائل العرب",
  "صفة جزيرة العرب",
  "نسب معد واليمن الكبير",
  "أنساب الأشراف",
  "جمهرة أنساب العرب",
  "الإكليل الهمداني"
];
const MAX_QUERIES = 20;
const MAX_RESULTS_PER_QUERY = 10;

export function validateDiscoveryOptions({ queries = DEFAULT_QUERIES, limit = 8 } = {}) {
  if (!Array.isArray(queries) || queries.length < 1 || queries.length > MAX_QUERIES) {
    throw new Error(`queries must contain 1 to ${MAX_QUERIES} search terms.`);
  }
  const normalized = queries.map(value => {
    if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 120) {
      throw new Error("Each search term must be a string between 2 and 120 characters.");
    }
    return value.trim();
  });
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS_PER_QUERY) {
    throw new Error(`limit must be an integer from 1 to ${MAX_RESULTS_PER_QUERY}.`);
  }
  return { queries: [...new Set(normalized)], limit };
}

export function normalizeSearchResult(page, query) {
  if (!page || typeof page.title !== "string" || !page.title.trim()) return null;
  const title = page.title.trim();
  const url = new URL("/wiki/" + title.replace(/ /g, "_"), "https://ar.wikisource.org");
  return {
    query,
    title,
    pageId: Number.isInteger(page.pageid) ? page.pageid : null,
    url: url.href,
    snippet: String(page.snippet ?? "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim(),
    namespace: Number.isInteger(page.ns) ? page.ns : null,
    status: "CANDIDATE_REQUIRES_BIBLIOGRAPHIC_REVIEW",
    warning: "نتيجة بحث فقط؛ لا تثبت مطابقة طبعة مطبوعة ولا صحة أي نسب."
  };
}

async function searchOne(query, limit) {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srnamespace", "0");
  url.searchParams.set("srlimit", String(limit));
  url.searchParams.set("srprop", "snippet");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const response = await fetch(url, {
    headers: { "User-Agent": "MajalisArabResearch/1.0 (bibliographic discovery; contact project maintainers)" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Wikisource search failed with HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload?.error || !Array.isArray(payload?.query?.search)) {
    throw new Error("Wikisource returned an invalid search response.");
  }
  return payload.query.search.map(page => normalizeSearchResult(page, query)).filter(Boolean);
}

async function main() {
  const args = process.argv.slice(2);
  const queryArgs = [];
  let limit = 8;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--query") {
      if (!args[i + 1]) throw new Error("--query requires a search phrase.");
      queryArgs.push(args[++i]);
    } else if (args[i] === "--limit") {
      limit = Number(args[++i]);
    } else {
      throw new Error(`Unknown argument: ${args[i]}`);
    }
  }
  const options = validateDiscoveryOptions({ queries: queryArgs.length ? queryArgs : DEFAULT_QUERIES, limit });
  const results = [];
  const failures = [];
  for (const query of options.queries) {
    try {
      results.push(...await searchOne(query, options.limit));
    } catch (error) {
      failures.push({ query, error: error instanceof Error ? error.message : "Search failed" });
    }
  }
  const unique = [...new Map(results.map(item => [item.url, item])).values()];
  process.stdout.write(JSON.stringify({
    queries: options.queries,
    candidatesFound: unique.length,
    candidates: unique,
    failures,
    nextStep: "راجع عنوان الكتاب والمؤلف والمحقق والطبعة وحقوق النص. لا يستورد هذا الأمر أي سجل ولا ينشئ كيانات أو دعاوى أو أنساب.",
    source: API
  }, null, 2) + "\n");
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(error => {
    process.stderr.write((error instanceof Error ? error.message : "Source discovery failed") + "\n");
    process.exitCode = 1;
  });
}
