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
    const requestUrl = new URL(request.url);
    const requestHost = (request.headers.get("host") || requestUrl.host).toLowerCase();

    // Compare the browser Origin with the actual Host header. Do not trust
    // arbitrary forwarded-host headers supplied by clients.
    if (originUrl.host.toLowerCase() !== requestHost) return false;

    return originUrl.protocol === "https:" ||
      originUrl.hostname === "localhost" ||
      originUrl.hostname === "127.0.0.1" ||
      originUrl.hostname === "[::1]";
  } catch {
    return false;
  }
}
