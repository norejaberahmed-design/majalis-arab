import { describe, expect, it } from "vitest";
import { parseEvidencePassageBatch } from "./evidence-passage-batch";

describe("parseEvidencePassageBatch", () => {
  it("parses spreadsheet rows with optional header and locator", () => {
    const result = parseEvidencePassageBatch(
      "الصفحة\tنص المقطع\tالمحدد الإضافي\nص 12\tهذا نص تاريخي منقول حرفيًا من الصفحة للاختبار.\tباب البلدان"
    );
    expect(result).toEqual({
      ok: true,
      passages: [{
        pageLabel: "ص 12",
        passageText: "هذا نص تاريخي منقول حرفيًا من الصفحة للاختبار.",
        locator: "باب البلدان"
      }]
    });
  });

  it("normalizes Windows newlines and skips blank lines", () => {
    const result = parseEvidencePassageBatch("ص 1\tهذا نص تاريخي طويل بما يكفي للتسجيل.\r\n\r\nص 2\tهذا مقطع آخر طويل بما يكفي للاختبار.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.passages).toHaveLength(2);
  });

  it("rejects rows without a tab-separated locator and passage", () => {
    expect(parseEvidencePassageBatch("هذا نص بلا موضع")).toEqual({
      ok: false,
      error: "السطر 1: استخدم عمودين أو ثلاثة مفصولة بعلامة تبويب."
    });
  });

  it("rejects too-short passages", () => {
    expect(parseEvidencePassageBatch("ص 4\tقصير")).toMatchObject({ ok: false });
  });

  it("limits batches to 50 rows", () => {
    const rows = Array.from({ length: 51 }, (_, i) => `ص ${i + 1}\tهذا نص تاريخي صالح وطويل بما يكفي للاختبار.`).join("\n");
    expect(parseEvidencePassageBatch(rows)).toMatchObject({ ok: false, error: "الحد الأقصى 50 مقطعًا في الدفعة الواحدة." });
  });
});
