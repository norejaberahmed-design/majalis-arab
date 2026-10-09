import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const reviewSchema = z.object({
  accessStatus: z.enum(["OPEN_ACCESS", "RESTRICTED", "UNAVAILABLE"]),
  extractionStatus: z.enum(["NOT_ATTEMPTED", "EXTRACTED", "OCR_REQUIRED", "FAILED"])
});

export async function PATCH(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") || !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "مراجعة بيانات المصدر متاحة لأمين كتالوج معتمد فقط" }, { status: 403, headers: NO_STORE });
    }
    const { id } = await route.params;
    if (!id || id.length > 64) return NextResponse.json({ error: "معرّف المصدر غير صالح" }, { status: 400, headers: NO_STORE });
    const body = await readJsonBody(request, 4096);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = reviewSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: "حالة المصدر غير صالحة" }, { status: 400, headers: NO_STORE });

    const source = await prisma.$transaction(async tx => {
      const existing = await tx.source.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return null;
      const updated = await tx.source.update({
        where: { id },
        data: { accessStatus: parsed.data.accessStatus, accessCheckedAt: new Date(), extractionStatus: parsed.data.extractionStatus, humanReviewed: true },
        select: { id: true, title: true, accessStatus: true, accessCheckedAt: true, extractionStatus: true, humanReviewed: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "CATALOGUE_SOURCE_REVIEWED",
          targetType: "Source",
          targetId: id,
          details: JSON.stringify({ accessStatus: updated.accessStatus, extractionStatus: updated.extractionStatus, humanReviewed: true })
        }
      });
      return updated;
    });
    if (!source) return NextResponse.json({ error: "المصدر غير موجود" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ data: source, message: "حُفظت مراجعة بيانات المصدر. يلزم فحص كل مقطع على حدة قبل ربطه بكيان." }, { headers: NO_STORE });
  } catch (error) {
    console.error("Catalogue source review failed", error);
    return NextResponse.json({ error: "تعذرت مراجعة بيانات المصدر" }, { status: 503, headers: NO_STORE });
  }
}
