import Link from "next/link";
import WorkspaceActions from "@/app/workspace-actions";
import RequestList from "./request-list";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/current-user";
import { roleAtLeast } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const workspace = await requireWorkspace();
  const canReview = roleAtLeast(workspace.role, "REVIEWER");
  const requests = await prisma.additionRequest.findMany({
    where: canReview
      ? { workspaceId: workspace.workspaceId }
      : { workspaceId: workspace.workspaceId, userId: workspace.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      proposedName: true,
      proposedKind: true,
      explanation: true,
      sourceUrl: true,
      status: true,
      reviewerNote: true,
      createdAt: true
    }
  });

  return (
    <main className="shell">
      <header className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>مجالس العرب</strong><small>طلبات الإضافة</small></span></Link>
        <div className="workspace-actions"><Link href="/">الرئيسية</Link><WorkspaceActions /></div>
      </header>
      <section className="page-intro">
        <p className="eyebrow">مراجعة منظمة</p>
        <h1>طلبات الإضافة</h1>
        <p className="intro">تُحفظ الاقتراحات داخل مساحة العمل. المراجعة تسجل قرارًا وملاحظة وتاريخًا في سجل التدقيق؛ ولا تنشر الكيان في الكتالوج المشترك تلقائيًا.</p>
      </section>
      {!canReview && <p className="muted">تعرض هذه الصفحة طلباتك فقط. تتطلب مراجعة طلبات بقية أعضاء المساحة دور المراجع أو المالك.</p>}
      <RequestList initialRequests={requests.map(item => ({ ...item, createdAt: item.createdAt.toISOString() }))} canReview={canReview} />
    </main>
  );
}
