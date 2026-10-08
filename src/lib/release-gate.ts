export function shouldBlockProduction(nodeEnv: string | undefined): boolean {
  return nodeEnv === "production";
}
