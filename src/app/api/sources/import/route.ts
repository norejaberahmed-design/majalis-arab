import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator, sourceInputSchema } from "@/lib/source-intake";
import { safeExternalHttpUrl } from "@/lib/safe-url";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const importSchema = z.object({ sources: z.array(z.unknown()).min(1).max(100) });

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "استيراد المصادر متاح لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 1_200_000);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = importSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "أرسل من 1 إلى 100 سجل مصدر في الطلب الواحد" }, { status: 400, headers: NO_STORE });

    const inputs: Array<{
      title: string; author?: string | null; publisher?: string | null; publicationYear?: number | null;
      edition?: string | null; url?: string | null; bibliographicNote?: string | null;
    }> = [];
    for (let index = 0; index < parsed.data.sources.length; index++) {
      const item = sourceInputSchema.safeParse(parsed.data.sources[index]);
      if (!item.success) return NextResponse.json({ error: "بيانات المصدر في الصف " + (index + 2) + " غير صالحة؛ راجع العنوان والسنة وطول الحقول." }, { status: 400, headers: NO_STORE });
      const safeUrl = item.data.url ? safeExternalHttpUrl(item.data.url) : null;
      if (item.data.url && !safeUrl) return NextResponse.json({ error: "الرابط في الصف " + (index + 2) + " غير صالح؛ استخدم HTTP أو HTTPS دون بيانات دخول." }, { status: 400, headers: NO_STORE });
      inputs.push({ ...item.data, url: safeUrl });
    }

    const result = await prisma.$transaction(async tx => {
      const created: Array<{ id: string; title: string }> = [];
      const duplicates: string[] = [];
      for (const input of inputs) {
        const duplicate = await tx.source.findFirst({
          where: {
            title: input.title,
            author: input.author || null,
            publisher: input.publisher || null,
            publicationYear: input.publicationYear ?? null,
            edition: input.edition || null,
          },
          select: { id: true }
        });
        if (duplicate) {
          duplicates.push(input.title);
          continue;
        }
        const source = await tx.source.create({
          data: {
            title: input.title,
            author: input.author || null,
            publisher: input.publisher || null,
            publicationYear: input.publicationYear ?? null,
            edition: input.edition || null,
            url: input.url || null,
            bibliographicNote: input.bibliographicNote || null,
            accessStatus: "NOT_CHECKED",
            extractionStatus: "NOT_ATTEMPTED",
            humanReviewed: false
          },
          select: { id: true, title: true }
        });
        created.push(source);
        await tx.auditLog.create({
          data: {
            workspaceId: context.workspaceId,
            actorUserId: context.user.id,
            actor: context.user.email,
            action: "CATALOGUE_SOURCE_IMPORTED",
            targetType: "Source",
            targetId: source.id,
            details: JSON.stringify({ importMethod: "CSV", accessStatus: "NOT_CHECKED", humanReviewed: false })
          }
        });
      }
      return { created, duplicates };
    });

    return NextResponse.json({
      data: { createdCount: result.created.length, duplicateCount: result.duplicates.length, created: result.created, duplicates: result.duplicates },
      message: "تم تسجيل " + result.created.length + " مصدرًا وتجاوز " + result.duplicates.length + " سجل مكرر. جميع المصادر الجديدة بانتظار التحقق والمراجعة."
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Catalogue CSV import failed", error);
    return NextResponse.json({ error: "تعذر استيراد المصادر حاليًا." }, { status: 503, headers: NO_STORE });
  }
}
