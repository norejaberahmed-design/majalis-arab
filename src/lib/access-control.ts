export type WorkspaceRole = "OWNER" | "EDITOR" | "REVIEWER" | "VIEWER";

const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  REVIEWER: 1,
  EDITOR: 2,
  OWNER: 3
};

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
