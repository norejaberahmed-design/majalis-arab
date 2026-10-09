import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { getWorkspaceContext, hasTrustedOrigin, roleAtLeast } from "@/lib/workspace";
import { isCatalogueCurator } from "@/lib/source-intake";
import { evidencePassageInputSchema } from "@/lib/evidence-passage";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: NextRequest, route: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const context = await getWorkspaceContext(request.headers);
    if (!context) return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل" }, { status: 401, headers: NO_STORE });
    if (!roleAtLeast(context.role, "REVIEWER") ||
        !isCatalogueCurator(context.user.email, process.env.CATALOGUE_CURATOR_EMAILS)) {
      return NextResponse.json({ error: "إضافة مقاطع الأدلة متاحة لأمين كتالوج معتمد فقط." }, { status: 403, headers: NO_STORE });
    }

    const { id: sourceId } = await route.params;
    if (!sourceId || sourceId.length > 64) {
      return NextResponse.json({ error: "معرّف المصدر غير صالح" }, { status: 400, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 8192);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = evidencePassageInputSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "أدخل رقم الصفحة أو موضعًا محددًا ومقطعًا نصيًا بين 10 و5000 حرف." }, { status: 400, headers: NO_STORE });
    }

    const source = await prisma.source.findUnique({ where: { id: sourceId }, select: { id: true } });
    if (!source) return NextResponse.json({ error: "المصدر غير موجود" }, { status: 404, headers: NO_STORE });

    const entityId = parsed.data.entityId || null;
    if (entityId) {
      const entity = await prisma.tribalEntity.findUnique({ where: { id: entityId }, select: { id: true } });
      if (!entity) return NextResponse.json({ error: "الكيان المرتبط غير موجود" }, { status: 400, headers: NO_STORE });
    }

    const passage = await prisma.$transaction(async tx => {
      const created = await tx.evidencePassage.create({
        data: {
          sourceId,
          entityId,
          pageLabel: parsed.data.pageLabel,
          passageText: parsed.data.passageText,
          locator: parsed.data.locator || null,
          reviewedByHuman: false
        },
        select: { id: true, sourceId: true, entityId: true, pageLabel: true, passageText: true, locator: true, reviewedByHuman: true, createdAt: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "CATALOGUE_EVIDENCE_PASSAGE_CREATED",
          targetType: "EvidencePassage",
          targetId: created.id,
          details: JSON.stringify({ sourceId, entityId, pageLabel: created.pageLabel, reviewedByHuman: false })
        }
      });
      return created;
    });

    return NextResponse.json({
      data: passage,
      message: "حُفظ المقطع مع موضعه. لم يُعتبر مراجعًا بشريًا ولم يثبت الادعاء تلقائيًا."
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("Evidence passage creation failed", error);
    return NextResponse.json({ error: "تعذر حفظ مقطع الدليل حاليًا." }, { status: 503, headers: NO_STORE });
  }
}
