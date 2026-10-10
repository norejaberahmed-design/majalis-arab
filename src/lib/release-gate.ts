export function shouldBlockProduction(nodeEnv: string | undefined): boolean {
  return nodeEnv === "production";
}

export function isAllowedDuringReleaseGate(path: string): boolean {
  return path === "/" ||
    path === "/research" ||
    path === "/login" ||
    path === "/setup" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path.startsWith("/api/auth/") ||
    path === "/api/workspaces" ||
    path === "/api/workspaces/active";
}
