import { z } from "zod";

export const sourceInputSchema = z.object({
  title: z.string().trim().min(2).max(300),
  author: z.string().trim().max(200).optional().or(z.literal("")),
  publisher: z.string().trim().max(200).optional().or(z.literal("")),
  publicationYear: z.number().int().min(1).max(2100).optional().nullable(),
  url: z.string().trim().max(2048).optional().or(z.literal("")),
  bibliographicNote: z.string().trim().max(3000).optional().or(z.literal(""))
});

export function isCatalogueCurator(email: string | null | undefined, configured: string | undefined) {
  if (!email || !configured?.trim()) return false;
  const allowed = new Set(configured.split(",").map(value => value.trim().toLocaleLowerCase("en-US")).filter(Boolean));
  return allowed.has(email.trim().toLocaleLowerCase("en-US"));
}
