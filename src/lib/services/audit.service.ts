// ─────────────────────────────────────────────
// Audit Service — تسجيل العمليات الحساسة
// append-only: لا تحديث ولا حذف
// ─────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  reason?: string;
  ipAddress?: string;
}

export async function logAudit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        previousValue: entry.previousValue ?? undefined,
        newValue: entry.newValue ?? undefined,
        reason: entry.reason ?? null,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Audit logging should not break the operation,
    // but we log the error for debugging
    console.error("Audit log failed:", error);
  }
}
