import Link from "next/link";
import { requireWorkspace } from "@/lib/current-user";
import MessagesClient from "./messages-client";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const workspace = await requireWorkspace();
  return (
    <main className="shell messages-shell" dir="rtl">
      <header className="topbar">
        <Link href="/council" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>المراسلات الخاصة</small></span></Link>
        <Link href="/council" className="sidebar-action">العودة إلى المجلس ←</Link>
      </header>
      <section className="page-intro">
        <p className="eyebrow">تواصل الأعضاء</p>
        <h1>المراسلات الخاصة</h1>
        <p className="intro">المحادثات متاحة فقط لطرفيها، وداخل المجلس الحالي فقط.</p>
      </section>
      <MessagesClient workspaceName={workspace.workspace.name} />
    </main>
  );
}
