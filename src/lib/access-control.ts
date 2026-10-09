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

    // Compare against the request's canonical origin, not a client-supplied
    // X-Forwarded-Host value. Reverse proxies must configure Next.js with the
    // canonical public URL instead of trusting arbitrary forwarding headers.
    if (originUrl.origin.toLowerCase() !== requestUrl.origin.toLowerCase()) return false;

    return originUrl.protocol === "https:" ||
      originUrl.hostname === "localhost" ||
      originUrl.hostname === "127.0.0.1" ||
      originUrl.hostname === "[::1]";
  } catch {
    return false;
  }
}
