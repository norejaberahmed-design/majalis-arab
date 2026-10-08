import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ACTIVE_WORKSPACE_COOKIE = "majalis_workspace";
export type WorkspaceRole = "OWNER" | "EDITOR" | "REVIEWER" | "VIEWER";

const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  REVIEWER: 1,
  EDITOR: 2,
  OWNER: 3
};

export async function getWorkspaceContext(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return null;
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (!workspaceId) return null;

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    select: { workspaceId: true, role: true, workspace: { select: { id: true, name: true } } }
  });
  if (!membership) return null;
  return {
    user: session.user,
    workspaceId: membership.workspaceId,
    workspace: membership.workspace,
    role: membership.role as WorkspaceRole
  };
}

export function roleAtLeast(role: string, minimum: WorkspaceRole) {
  const current = ROLE_LEVEL[role as WorkspaceRole];
  const required = ROLE_LEVEL[minimum];
  return current !== undefined && current >= required;
}

export function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!host) return false;
    return originUrl.host.toLowerCase() === host.toLowerCase() &&
      (originUrl.protocol === "https:" || originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}
