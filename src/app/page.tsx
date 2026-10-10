import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function HomePage() {
  const session = await getCurrentUser();
  if (!session?.user?.id) redirect("/login");

  const workspace = await getWorkspaceContext(await headers());
  if (!workspace) redirect("/setup");

  redirect("/council");
}
