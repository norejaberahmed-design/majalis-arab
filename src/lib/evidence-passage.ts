import { z } from "zod";

export const evidencePassageInputSchema = z.object({
  pageLabel: z.string().trim().min(1).max(120),
  passageText: z.string().trim().min(10).max(5000),
  locator: z.string().trim().max(500).optional().or(z.literal("")),
  entityId: z.string().trim().min(1).max(64).optional().or(z.literal(""))
});
