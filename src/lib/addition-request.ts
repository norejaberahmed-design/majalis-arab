import { z } from "zod";

export const additionRequestSchema = z.object({
  proposedName: z.string().trim().min(2).max(160),
  proposedKind: z.enum(["TRIBE", "CLAN", "FAMILY", "PERSON", "PLACE", "OTHER"]),
  explanation: z.string().trim().min(10).max(3000),
  sourceUrl: z.string().trim().max(2048).optional().or(z.literal(""))
});
