import Link from "next/link";
import { requireWorkspace } from "@/lib/current-user";
import AssistantChat from "./assistant-chat";
import "./assistant.css";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireWorkspace();
  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="مجالس العرب - الرئيسية">
          <span className="brand-mark">م</span>
          <span><strong>مجالس العرب</strong><small>المساعد المعرفي</small></span>
        </Link>
        <Link className="secondary-button" href="/council">العودة إلى المجلس</Link>
      </header>
      <section className="hero assistant-hero">
        <p className="eyebrow">مساعد محايد</p>
        <h1>الفهم أولًا، ثم الاستنتاج.</h1>
        <p className="intro">مساعد للحوار والتحليل والتلخيص ومقارنة المصادر. لا يفترض صحة الرواية دون دليل، ولا ينحاز لأي طرف.</p>
      </section>
      <AssistantChat />
      <footer><span>مجالس العرب</span><span>تحليل مساعد لا يغني عن مراجعة المصادر الأصلية.</span></footer>
    </main>
  );
}
