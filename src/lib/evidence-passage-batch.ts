export type EvidencePassageBatchRow = {
  pageLabel: string;
  passageText: string;
  locator?: string;
};

export type EvidencePassageBatchParseResult =
  | { ok: true; passages: EvidencePassageBatchRow[] }
  | { ok: false; error: string };

const MAX_ROWS = 50;
const MAX_PAGE_LABEL = 120;
const MAX_PASSAGE_TEXT = 5000;
const MAX_LOCATOR = 500;

/**
 * Parse tab-separated lines copied from a spreadsheet:
 * page/locator label<TAB>verbatim passage text<TAB>optional extra locator.
 * A first header row is accepted when its first two cells identify the columns.
 */
export function parseEvidencePassageBatch(input: string): EvidencePassageBatchParseResult {
  if (!input.trim()) return { ok: false, error: "أدخل مقطعًا واحدًا على الأقل." };

  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const passages: EvidencePassageBatchRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    if (!line.trim()) continue;

    const columns = line.split("\t");
    const first = columns[0]?.trim().toLocaleLowerCase("ar");
    const second = columns[1]?.trim().toLocaleLowerCase("ar");
    if (passages.length === 0 && index === 0 &&
      ["الصفحة", "رقم الصفحة", "الموضع", "page", "page label"].includes(first) &&
      ["النص", "نص المقطع", "المقطع", "text", "passage text"].includes(second)) {
      continue;
    }

    if (columns.length < 2 || columns.length > 3) {
      return { ok: false, error: `السطر ${index + 1}: استخدم عمودين أو ثلاثة مفصولة بعلامة تبويب.` };
    }

    const pageLabel = columns[0].trim();
    const passageText = columns[1].trim();
    const locator = (columns[2] ?? "").trim();

    if (!pageLabel || pageLabel.length > MAX_PAGE_LABEL) {
      return { ok: false, error: `السطر ${index + 1}: موضع الصفحة مطلوب وبحد أقصى 120 حرفًا.` };
    }
    if (passageText.length < 10 || passageText.length > MAX_PASSAGE_TEXT) {
      return { ok: false, error: `السطر ${index + 1}: يجب أن يكون نص المقطع بين 10 و5000 حرف.` };
    }
    if (locator.length > MAX_LOCATOR) {
      return { ok: false, error: `السطر ${index + 1}: المحدد الإضافي يتجاوز 500 حرف.` };
    }

    passages.push({ pageLabel, passageText, ...(locator ? { locator } : {}) });
    if (passages.length > MAX_ROWS) {
      return { ok: false, error: `الحد الأقصى 50 مقطعًا في الدفعة الواحدة.` };
    }
  }

  if (passages.length === 0) return { ok: false, error: "لم يتم العثور على مقاطع صالحة." };
  return { ok: true, passages };
}
