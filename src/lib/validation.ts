import { z } from "zod";

export const entityInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  kind: z.enum(["TRIBE", "CLAN", "FAMILY", "PERSON", "PLACE", "OTHER"]),
  summary: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal(""))
});

export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar");
}