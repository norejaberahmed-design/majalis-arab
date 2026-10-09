import { z } from "zod";

const extractionSchema = z.object({
  suggestions: z.array(z.object({
    statement: z.string().trim().min(8).max(500),
    evidenceQuote: z.string().trim().min(10).max(1200)
  })).max(5)
});

export type EvidenceClaimDraft = z.infer<typeof extractionSchema>["suggestions"][number];

/**
 * Server-only extraction. The model may propose review drafts, never publish facts.
 * Every quote must be a literal substring of the supplied excerpt.
 */
export function validateEvidenceDrafts(value: unknown, passageText: string): EvidenceClaimDraft[] {
  const parsed = extractionSchema.safeParse(value);
  if (!parsed.success) return [];
  const seen = new Set<string>();
  return parsed.data.suggestions.filter(item => {
    const statement = item.statement.replace(/\s+/g, " ").trim();
    const quote = item.evidenceQuote.trim();
    const key = statement.toLocaleLowerCase("ar");
    if (!passageText.includes(quote) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(item => ({
    statement: item.statement.replace(/\s+/g, " ").trim(),
    evidenceQuote: item.evidenceQuote.trim()
  }));
}

export async function extractEvidenceDrafts(passageText: string): Promise<EvidenceClaimDraft[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "أنت محرر مصادر تاريخية. استخرج حتى خمسة ادعاءات تاريخية صريحة فقط من المقطع المعطى. لا تستنتج نسبًا أو حلفًا أو هجرة أو تاريخًا غير مذكور صراحة. لا تستخدم معرفة خارج المقطع. لكل ادعاء أعد evidenceQuote حرفيًا كما يظهر داخل المقطع وبطول 10 أحرف على الأقل. إذا لم يوجد ادعاء صريح فأعد مصفوفة فارغة. أخرج JSON فقط بالشكل {\"suggestions\":[{\"statement\":\"...\",\"evidenceQuote\":\"...\"}]}."
        },
        { role: "user", content: passageText.slice(0, 12000) }
      ]
    }),
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error(`Evidence extraction provider returned ${response.status}`);
  }
  const payload: unknown = await response.json();
  const envelope = z.object({
    choices: z.array(z.object({
      message: z.object({ content: z.string().nullable() })
    })).min(1)
  }).safeParse(payload);
  if (!envelope.success || !envelope.data.choices[0].message.content) return [];

  let decoded: unknown;
  try {
    decoded = JSON.parse(envelope.data.choices[0].message.content);
  } catch {
    return [];
  }
  return validateEvidenceDrafts(decoded, passageText);
}
