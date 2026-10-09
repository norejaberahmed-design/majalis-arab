import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const passageSchema = z.object({
  pageLabel: z.string().trim().min(1).max(120),
  passageText: z.string().trim().min(10).max(5000),
  locator: z.string().trim().max(500).optional().or(z.literal(""))
});
const importSchema = z.object({ passages: z.array(z.unknown()).min(1).max(50) });

export async function POST(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") ||
        !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "استيراد المقاطع متاح لأمين كتالوج معتمد فقط." }, { status: 403, headers: NO_STORE });
    }

    const { id: sourceId } = await route.params;
    if (!sourceId || sourceId.length > 64) {
      return NextResponse.json({ error: "معرّف المصدر غير صالح" }, { status: 400, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 300_000);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = importSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "أرسل من 1 إلى 50 مقطعًا في الطلب الواحد." }, { status: 400, headers: NO_STORE });
    }

    const passages: Array<{ pageLabel: string; passageText: string; locator?: string }> = [];
    for (let index = 0; index < parsed.data.passages.length; index += 1) {
      const item = passageSchema.safeParse(parsed.data.passages[index]);
      if (!item.success) {
        return NextResponse.json({ error: `بيانات المقطع رقم ${index + 1} غير صالحة؛ تحقق من الموضع وطول النص.` }, { status: 400, headers: NO_STORE });
      }
      passages.push(item.data);
    }

    const source = await prisma.source.findUnique({ where: { id: sourceId }, select: { id: true } });
    if (!source) return NextResponse.json({ error: "المصدر غير موجود" }, { status: 404, headers: NO_STORE });

    const result = await prisma.$transaction(async tx => {
      const created: Array<{ id: string; pageLabel: string; passageText: string }> = [];
      const duplicates: string[] = [];
      for (const passage of passages) {
        const duplicate = await tx.evidencePassage.findFirst({
          where: { sourceId, pageLabel: passage.pageLabel, passageText: passage.passageText },
          select: { id: true }
        });
        if (duplicate) {
          duplicates.push(passage.pageLabel);
          continue;
        }
        const item = await tx.evidencePassage.create({
          data: {
            sourceId,
            pageLabel: passage.pageLabel,
            passageText: passage.passageText,
            locator: passage.locator || null,
            reviewedByHuman: false
          },
          select: { id: true, pageLabel: true, passageText: true }
        });
        created.push(item);
        await tx.auditLog.create({
          data: {
            workspaceId: context.workspaceId,
            actorUserId: context.user.id,
            actor: context.user.email,
            action: "CATALOGUE_EVIDENCE_PASSAGE_IMPORTED",
            targetType: "EvidencePassage",
            targetId: item.id,
            details: JSON.stringify({ sourceId, pageLabel: item.pageLabel, reviewedByHuman: false, importMethod: "TSV" })
          }
        });
      }
      return { created, duplicates };
    });

    return NextResponse.json({
      data: {
        createdCount: result.created.length,
        duplicateCount: result.duplicates.length,
        created: result.created.map(item => ({ id: item.id, pageLabel: item.pageLabel })),
        duplicates: result.duplicates
      },
      message: `تم حفظ ${result.created.length} مقطعًا وتجاوز ${result.duplicates.length} مكررًا. جميع المقاطع الجديدة غير مراجعة بشريًا.`
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Bulk evidence passage import failed", error);
    return NextResponse.json({ error: "تعذر استيراد المقاطع حاليًا." }, { status: 503, headers: NO_STORE });
  }
}
