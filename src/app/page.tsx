import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function HomePage() {
  const requestHeaders = await headers();
  const workspace = await getWorkspaceContext(requestHeaders);

  if (workspace) {
    redirect("/research");
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session?.user?.id) {
    redirect("/setup");
  }

  redirect("/login");
}
