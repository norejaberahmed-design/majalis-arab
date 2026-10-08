import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleAtLeast, hasTrustedOrigin } from "@/lib/access-control";
export { roleAtLeast, hasTrustedOrigin } from "@/lib/access-control";

export const ACTIVE_WORKSPACE_COOKIE = "majalis_workspace";
export type WorkspaceRole = import("@/lib/access-control").WorkspaceRole;

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

