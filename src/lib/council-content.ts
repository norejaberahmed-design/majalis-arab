import { z } from "zod";

export const councilPostSchema = z.object({
  content: z.string().trim().min(1).max(5000)
});

export const councilCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000)
});
