"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import CouncilMembers from "./council-members";
import TribeCouncilLink from "./tribe-council-link";

type Workspace = { id: string; name: string; role: string };

export default function WorkspaceSetupPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/workspaces", { cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "تعذر تحميل المساحات"); setWorkspaces(data.data || []); })
      .catch(e => setMessage(e instanceof Error ? e.message : "تعذر تحميل المساحات"));
  }, [session]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "تعذر إنشاء مساحة العمل"); return; }
      router.replace("/");
      router.refresh();
    } catch { setMessage("تعذر الاتصال بالخدمة."); }
    finally { setBusy(false); }
  }

  async function openWorkspace(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id })
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "تعذر اختيار المساحة"); return; }
      router.replace("/"); router.refresh();
    } catch { setMessage("تعذر الاتصال بالخدمة."); }
    finally { setBusy(false); }
  }

  if (isPending || !session) return <main className="auth-shell">جارٍ التحقق من الجلسة…</main>;
  return <main className="auth-shell" dir="rtl">
    <section className="auth-card">
      <Link href="/council" className="auth-brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>مجالس العرب</small></span></Link>
      <p className="eyebrow">مجتمعك العربي</p><h1>اختر مجلسًا</h1>
      <p className="muted">لكل مجلس أعضاؤه ونقاشاته. يمكنك الدخول إلى مجلس أنت عضو فيه أو إنشاء مجلس جديد.</p>
      {workspaces.map(w => <button className="workspace-choice" key={w.id} type="button" disabled={busy} onClick={() => openWorkspace(w.id)}><strong>{w.name}</strong><span>{w.role}</span></button>)}
      <form onSubmit={createWorkspace}>
        <label>إنشاء مجلس جديد<input value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} required placeholder="مثال: مجلس العائلة أو القبيلة" /></label>
        {message && <p role="alert" className="auth-error">{message}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء المجلس"}</button>
      </form>
      <div className="setup-divider" />
      <CouncilMembers />
      <TribeCouncilLink />
    </section>
  </main>;
}
