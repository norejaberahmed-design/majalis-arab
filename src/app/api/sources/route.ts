import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { safeExternalHttpUrl } from "@/lib/safe-url";
import { isCatalogueCurator, sourceInputSchema } from "@/lib/source-intake";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) {
      return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    }
    if (!roleAtLeast(context.role, "REVIEWER") ||
        !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "إضافة المصادر متاحة لأمين كتالوج معتمد فقط." }, { status: 403, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 8192);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    }
    const parsed = sourceInputSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "عنوان المصدر مطلوب، وتحقق من طول الحقول وسنة النشر." }, { status: 400, headers: NO_STORE });
    }

    const input = parsed.data;
    const url = input.url ? safeExternalHttpUrl(input.url) : null;
    if (input.url && !url) {
      return NextResponse.json({ error: "رابط المصدر يجب أن يكون HTTP أو HTTPS صالحًا ومن دون بيانات دخول." }, { status: 400, headers: NO_STORE });
    }

    const source = await prisma.$transaction(async tx => {
      const saved = await tx.source.create({
        data: {
          title: input.title,
          author: input.author || null,
          publisher: input.publisher || null,
          publicationYear: input.publicationYear ?? null,
          edition: input.edition || null,
          url,
          bibliographicNote: input.bibliographicNote || null,
          accessStatus: "NOT_CHECKED",
          extractionStatus: "NOT_ATTEMPTED",
          humanReviewed: false
        },
        select: { id: true, title: true, author: true, publisher: true, publicationYear: true, edition: true, url: true, createdAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "CATALOGUE_SOURCE_CREATED",
          targetType: "Source",
          targetId: saved.id,
          details: JSON.stringify({ accessStatus: "NOT_CHECKED", humanReviewed: false })
        }
      });
      return saved;
    });

    return NextResponse.json({
      data: source,
      message: "سُجل المرجع في الكتالوج المشترك بحالة «لم يُتحقق من الإتاحة». لم يُعتبر دليلًا أو مرجعًا مراجعًا تلقائيًا."
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Catalogue source creation failed", error);
    return NextResponse.json({ error: "تعذر تسجيل المصدر حاليًا." }, { status: 503, headers: NO_STORE });
  }
}
