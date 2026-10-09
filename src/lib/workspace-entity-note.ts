import { z } from "zod";

export const workspaceEntityNoteSchema = z.object({
  note: z.string().trim().min(1).max(5000)
});
