"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function WorkspaceActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return <div className="workspace-actions">
    <Link href="/setup">مساحة العمل</Link>
    <button type="button" onClick={signOut} disabled={busy}>{busy ? "جارٍ الخروج…" : "تسجيل الخروج"}</button>
  </div>;
}
