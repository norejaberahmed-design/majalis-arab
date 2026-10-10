import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export async function getCurrentUser() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireWorkspace() {
  const requestHeaders = await headers();
  const context = await getWorkspaceContext(requestHeaders);
  if (!context) redirect("/setup");
  return context;
}

export async function requireUser() {
  const session = await getCurrentUser();
  if (!session?.user?.id) redirect("/");
  return session;
}
