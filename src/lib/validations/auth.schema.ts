import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  displayName: z.string().min(2, "اسم العرض يجب أن يكون حرفين على الأقل").max(50, "اسم العرض طويل جدًا"),
});

export const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export const profileSchema = z.object({
  displayName: z.string().min(2, "اسم العرض يجب أن يكون حرفين على الأقل").max(50),
  bio: z.string().max(500, "النبذة طويلة جدًا").optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const privacySettingsSchema = z.object({
  showEmail: z.boolean().default(false),
  showActivity: z.boolean().default(true),
  allowDirectMessages: z.boolean().default(true),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
