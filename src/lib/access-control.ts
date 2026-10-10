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
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host") || requestUrl.host;
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto || requestUrl.protocol.replace(/:$/, "");
    const canonicalOrigin = `${protocol}://${host}`;

    // Compare the browser origin with the public host serving this request.
    // Hosting proxies may expose an internal request URL, so prefer their
    // forwarded public host/protocol when present.
    if (originUrl.origin.toLowerCase() !== canonicalOrigin.toLowerCase() &&
        originUrl.origin.toLowerCase() !== requestUrl.origin.toLowerCase()) return false;

    return originUrl.protocol === "https:" ||
      originUrl.hostname === "localhost" ||
      originUrl.hostname === "127.0.0.1" ||
      originUrl.hostname === "[::1]";
  } catch {
    return false;
  }
}
