// ─────────────────────────────────────────────
// Users Service — منطق إدارة المستخدمين
// كل فحوص الصلاحيات هنا (RULE 5, RULE 6)
// ─────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { UserRole, UserStatus, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { logAudit } from "./audit.service";
import { hasCapability, type Capability } from "@/lib/permissions/capabilities";

// ── إنشاء مستخدم (تسجيل) ──
export async function createUser(params: {
  email: string;
  password: string;
  displayName: string;
}) {
  const email = params.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("البريد الإلكتروني مستخدم بالفعل");

  const passwordHash = await bcrypt.hash(params.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: params.displayName,
      role: "USER",
      status: "ACTIVE",
    },
    select: { id: true, email: true, displayName: true, role: true },
  });

  await logAudit({
    actorId: user.id,
    action: "USER_REGISTER",
    entityType: "User",
    entityId: user.id,
    newValue: { email: user.email, displayName: user.displayName, role: "USER" },
  });

  return user;
}

// ── جلب مستخدم ──
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      role: true,
      status: true,
      privacySettings: true,
      createdAt: true,
    },
  });
}

// ── تحديث الملف الشخصي ──
export async function updateProfile(
  userId: string,
  params: { displayName?: string; bio?: string | null; avatarUrl?: string | null }
) {
  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, bio: true, avatarUrl: true },
  });
  if (!previous) throw new Error("المستخدم غير موجود");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: params.displayName,
      bio: params.bio,
      avatarUrl: params.avatarUrl,
    },
    select: { id: true, displayName: true, bio: true, avatarUrl: true },
  });

  await logAudit({
    actorId: userId,
    action: "PROFILE_UPDATE",
    entityType: "User",
    entityId: userId,
    previousValue: previous as Prisma.InputJsonValue,
    newValue: updated as Prisma.InputJsonValue,
  });

  return updated;
}

// ── تحديث إعدادات الخصوصية ──
export async function updatePrivacySettings(
  userId: string,
  settings: Prisma.InputJsonValue
) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { privacySettings: settings },
    select: { id: true, privacySettings: true },
  });

  await logAudit({
    actorId: userId,
    action: "PRIVACY_UPDATE",
    entityType: "User",
    entityId: userId,
    newValue: settings,
  });

  return updated;
}

// ── تغيير دور مستخدم (ADMIN فقط) ──
export async function changeUserRole(
  adminId: string,
  adminRole: UserRole,
  targetUserId: string,
  newRole: UserRole,
  reason?: string
) {
  // RULE 5: تحقق على الخادم
  if (!hasCapability(adminRole, "role:manage")) {
    throw new Error("ليس لديك صلاحية تغيير الأدوار");
  }
  // RULE 6: لا ثقة في بيانات العميل — newRole يُفحص هنا كـ enum
  if (!Object.values(UserRole).includes(newRole)) {
    throw new Error("دور غير صالح");
  }

  const previous = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true, displayName: true, email: true },
  });
  if (!previous) throw new Error("المستخدم غير موجود");

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: { id: true, role: true },
  });

  await logAudit({
    actorId: adminId,
    action: "CHANGE_ROLE",
    entityType: "User",
    entityId: targetUserId,
    previousValue: { role: previous.role },
    newValue: { role: newRole },
    reason,
  });

  return updated;
}

// ── تغيير حالة مستخدم (ADMIN فقط) ──
export async function changeUserStatus(
  adminId: string,
  adminRole: UserRole,
  targetUserId: string,
  newStatus: UserStatus,
  reason?: string
) {
  if (!hasCapability(adminRole, "user:manage")) {
    throw new Error("ليس لديك صلاحية إدارة المستخدمين");
  }
  if (!Object.values(UserStatus).includes(newStatus)) {
    throw new Error("حالة غير صالحة");
  }

  const previous = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { status: true },
  });
  if (!previous) throw new Error("المستخدم غير موجود");

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { status: newStatus },
    select: { id: true, status: true },
  });

  await logAudit({
    actorId: adminId,
    action: "CHANGE_STATUS",
    entityType: "User",
    entityId: targetUserId,
    previousValue: { status: previous.status },
    newValue: { status: newStatus },
    reason,
  });

  return updated;
}

// ── قائمة المستخدمين (ADMIN فقط) ──
export async function listUsers(
  adminRole: UserRole,
  params: { page?: number; pageSize?: number; search?: string }
) {
  if (!hasCapability(adminRole, "user:manage")) {
    throw new Error("ليس لديك صلاحية إدارة المستخدمين");
  }

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 50);
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {};
  if (params.search) {
    where.OR = [
      { displayName: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
