import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/http";
import { normalizeName } from "@/lib/validation";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { safeExternalHttpUrl } from "@/lib/safe-url";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const inputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  content: z.string().trim().min(10).max(3000),
  sourceUrl: z.string().trim().max(2048).optional().or(z.literal(""))
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }
  const context = await getWorkspaceContext(request.headers);
  if (!context) {
    return NextResponse.json({ error: "سجّل الدخول قبل إضافة قبيلة أو معلومات عنها" }, { status: 401, headers: NO_STORE });
  }

  const body = await readJsonBody(request, 20_000);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
  const parsed = inputSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل اسم القبيلة ومعلومات لا تقل عن 10 أحرف، ويمكن إضافة رابط مصدر." }, { status: 400, headers: NO_STORE });
  }

  const name = parsed.data.name.replace(/\s+/g, " ");
  const normalizedName = normalizeName(name);
  const sourceUrl = parsed.data.sourceUrl ? safeExternalHttpUrl(parsed.data.sourceUrl) : null;
  if (parsed.data.sourceUrl && !sourceUrl) {
    return NextResponse.json({ error: "رابط المصدر غير صالح؛ استخدم رابط HTTP أو HTTPS صحيحًا." }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await prisma.$transaction(async tx => {
      let entity = await tx.tribalEntity.findUnique({
        where: { normalizedName },
        select: { id: true, name: true, kind: true }
      });
      let created = false;
      if (!entity) {
        entity = await tx.tribalEntity.create({
          data: { name, normalizedName, kind: "TRIBE" },
          select: { id: true, name: true, kind: true }
        });
        created = true;
      }

      const duplicate = await tx.tribeKnowledgeEntry.findFirst({
        where: { entityId: entity.id, content: parsed.data.content },
        select: { id: true }
      });
      let entry = duplicate;
      let entryCreated = false;
      if (!entry) {
        entry = await tx.tribeKnowledgeEntry.create({
          data: {
            entityId: entity.id,
            content: parsed.data.content,
            sourceUrl,
            createdByUserId: context.user.id,
            status: "UNREVIEWED"
          },
          select: { id: true }
        });
        entryCreated = true;
      }

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: created ? "SHARED_TRIBE_CREATED" : entryCreated ? "SHARED_TRIBE_KNOWLEDGE_ADDED" : "SHARED_TRIBE_KNOWLEDGE_DUPLICATE",
          targetType: created ? "TribalEntity" : "TribeKnowledgeEntry",
          targetId: created ? entity.id : entry.id,
          details: JSON.stringify({ entityId: entity.id, status: "UNREVIEWED", sourceUrl: sourceUrl ? "provided" : "not_provided" })
        }
      });
      return { entity, created, entryId: entry.id, entryCreated };
    });

    return NextResponse.json({
      data: { ...result.entity, entryId: result.entryId, created: result.created, entryCreated: result.entryCreated },
      message: result.created
        ? "تم إنشاء سجل القبيلة المشترك وحفظ المعلومات. ستظهر البيانات نفسها لجميع المستخدمين، والمعلومات الجديدة غير مراجعة."
        : result.entryCreated
          ? "القبيلة موجودة بالفعل؛ أضفنا مساهمتك إلى سجلها المشترك، وهي بانتظار المراجعة."
          : "القبيلة وهذه المعلومة مسجلتان بالفعل؛ لم ننشئ نسخة مكررة."
    }, { status: result.created ? 201 : 200, headers: NO_STORE });
  } catch (error) {
    console.error("Shared tribe creation failed", error);
    return NextResponse.json({ error: "تعذر حفظ القبيلة ومعلوماتها حاليًا." }, { status: 503, headers: NO_STORE });
  }
}
