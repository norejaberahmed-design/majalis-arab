"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type Workspace = { id: string; name: string; role: string };

export default function WorkspaceSetupPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
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
      <Link href="/" className="auth-brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>مساحات العمل</small></span></Link>
      <p className="eyebrow">تنظيم الصلاحيات</p><h1>اختر مساحة عمل</h1>
      <p className="muted">كل مساحة لها عضويتها وصلاحياتها. لا يمكنك فتح مساحة لا تنتمي إليها.</p>
      {workspaces.map(w => <button className="workspace-choice" key={w.id} type="button" disabled={busy} onClick={() => openWorkspace(w.id)}><strong>{w.name}</strong><span>{w.role}</span></button>)}
      <form onSubmit={createWorkspace}>
        <label>إنشاء مساحة جديدة<input value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} required placeholder="مثال: فريق البحث" /></label>
        {message && <p role="alert" className="auth-error">{message}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "جارٍ الحفظ…" : "إنشاء مساحة عمل"}</button>
      </form>
    </section>
  </main>;
}
