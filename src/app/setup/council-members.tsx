"use client";

import { FormEvent, useEffect, useState } from "react";

type Member = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
};

export default function CouncilMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadMembers() {
    try {
      const response = await fetch("/api/workspaces/members", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "اختر مجلسًا لعرض أعضائه."); return; }
      setMembers(result.data.members);
      setWorkspaceName(result.data.workspace.name);
      setRole(result.data.role);
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadMembers(); }, []);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspaces/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "تعذرت إضافة العضو."); return; }
      setMembers(current => [...current, result.data]);
      setEmail("");
      setMessage(result.message || "تمت إضافة العضو.");
    } catch {
      setMessage("تعذر الاتصال بالخدمة.");
    } finally {
      setBusy(false);
    }
  }

  const canManage = role === "OWNER" || role === "EDITOR";
  return (
    <section className="panel members-panel">
      <div className="list-heading"><div><p className="eyebrow">المجتمع</p><h2>أعضاء المجلس {workspaceName ? "· " + workspaceName : ""}</h2></div><span className="count-pill">{members.length}</span></div>
      {loading ? <p className="muted">جارٍ تحميل الأعضاء…</p> : members.length === 0 ? <p className="muted">اختر مجلسًا لعرض الأعضاء.</p> :
        <div className="members-list">{members.map(member => <article className="member-row" key={member.id}>
          <span className="member-avatar">{member.user.name.trim().slice(0, 1) || "ع"}</span>
          <div className="member-details"><strong>{member.user.name}</strong><small>{member.user.email}</small></div>
          <span className="member-role">{member.role === "OWNER" ? "مالك المجلس" : member.role === "EDITOR" ? "محرر" : member.role === "REVIEWER" ? "مراجع" : "عضو"}</span>
        </article>)}</div>}
      {canManage && <form className="member-add-form" onSubmit={addMember}>
        <label htmlFor="council-member-email">إضافة شخص لديه حساب مسجل</label>
        <div className="member-add-row"><input id="council-member-email" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required placeholder="البريد الإلكتروني للعضو" /><button type="submit" disabled={busy || !email.trim()}>{busy ? "جارٍ الإضافة…" : "إضافة عضو"}</button></div>
        <small>يجب أن يكون الشخص قد أنشأ حسابًا في مجالس العرب. يُضاف بدور عضو، ويمكنه بعدها اختيار هذا المجلس.</small>
      </form>}
      {message && <p className="form-message" role="status">{message}</p>}
    </section>
  );
}
