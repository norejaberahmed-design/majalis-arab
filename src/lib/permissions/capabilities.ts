// ─────────────────────────────────────────────
// مصفوفة القدرات — Capability Matrix
// الأدوار متوازية وليست تسلسلًا هرميًا
// ─────────────────────────────────────────────

import { UserRole } from "@prisma/client";

// كل قدرة كـ string literal type للأمان
export type Capability =
  // ── قراءة وبحث ──
  | "content:read"
  | "search"
  // ── محتوى مجتمعي (PHASE 5) ──
  | "post:create"
  | "post:edit_own"
  | "post:delete_own"
  | "comment:create"
  | "like"
  | "bookmark"
  | "report"
  // ── مساهمات معرفية ──
  | "claim:submit"
  | "claim:suggest_correction"
  | "source:add"
  | "evidence:upload"
  | "person:add"
  | "relationship:propose"
  | "page:propose"
  // ── مراجعة المعرفة ──
  | "claim:review"
  | "claim:approve"
  | "claim:reject"
  | "claim:request_evidence"
  | "source:review"
  | "narrative:manage"
  | "conflict:manage"
  | "document:verify"
  // ── الإشراف المجتمعي ──
  | "moderation:posts"
  | "moderation:comments"
  | "moderation:reports"
  | "moderation:action"
  // ── إدارة النظام ──
  | "user:manage"
  | "role:manage"
  | "content:manage_all"
  | "source:manage"
  | "review:manage"
  | "system:manage"
  | "audit:read";

// المصفوفة: دور → مجموعة القدرات
const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  USER: [
    "content:read",
    "search",
    "post:create",
    "post:edit_own",
    "post:delete_own",
    "comment:create",
    "like",
    "bookmark",
    "report",
    "claim:suggest_correction",
  ],
  CONTRIBUTOR: [
    "content:read",
    "search",
    "post:create",
    "post:edit_own",
    "post:delete_own",
    "comment:create",
    "like",
    "bookmark",
    "report",
    "claim:suggest_correction",
    "claim:submit",
    "source:add",
    "evidence:upload",
    "person:add",
    "relationship:propose",
    "page:propose",
  ],
  RESEARCHER: [
    "content:read",
    "search",
    "post:create",
    "post:edit_own",
    "post:delete_own",
    "comment:create",
    "like",
    "bookmark",
    "report",
    "claim:suggest_correction",
    "claim:submit",
    "source:add",
    "evidence:upload",
    "person:add",
    "relationship:propose",
    "page:propose",
    "claim:review",
    "claim:approve",
    "claim:reject",
    "claim:request_evidence",
    "source:review",
    "narrative:manage",
    "conflict:manage",
    "document:verify",
  ],
  MODERATOR: [
    "content:read",
    "search",
    "post:create",
    "post:edit_own",
    "post:delete_own",
    "comment:create",
    "like",
    "bookmark",
    "report",
    "claim:suggest_correction",
    "moderation:posts",
    "moderation:comments",
    "moderation:reports",
    "moderation:action",
  ],
  ADMIN: [
    // ADMIN له كل القدرات
    "content:read",
    "search",
    "post:create",
    "post:edit_own",
    "post:delete_own",
    "comment:create",
    "like",
    "bookmark",
    "report",
    "claim:suggest_correction",
    "claim:submit",
    "source:add",
    "evidence:upload",
    "person:add",
    "relationship:propose",
    "page:propose",
    "claim:review",
    "claim:approve",
    "claim:reject",
    "claim:request_evidence",
    "source:review",
    "narrative:manage",
    "conflict:manage",
    "document:verify",
    "moderation:posts",
    "moderation:comments",
    "moderation:reports",
    "moderation:action",
    "user:manage",
    "role:manage",
    "content:manage_all",
    "source:manage",
    "review:manage",
    "system:manage",
    "audit:read",
  ],
};

// فحص قدرة واحدة
export function hasCapability(role: UserRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

// فحص مجموعة قدرات (يحتاج كلها)
export function hasAllCapabilities(role: UserRole, ...capabilities: Capability[]): boolean {
  return capabilities.every((c) => hasCapability(role, c));
}

// فحص أي قدرة من مجموعة (يحتاج واحدة على الأقل)
export function hasAnyCapability(role: UserRole, ...capabilities: Capability[]): boolean {
  return capabilities.some((c) => hasCapability(role, c));
}

export { ROLE_CAPABILITIES };
