import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeName } from "@/lib/validation";
import { readJsonBody } from "@/lib/http";
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
    return NextResponse.json({ error: "سجّل الدخول قبل إرسال اسم قبيلة أو معلومات عنها" }, { status: 401, headers: NO_STORE });
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
      const entity = await tx.tribalEntity.findUnique({
        where: { normalizedName },
        select: { id: true, name: true, kind: true }
      });

      // Existing tribe profiles accept shared contributions, but every entry
      // stays visibly UNREVIEWED until a separate review process verifies it.
      if (entity) {
        const duplicateEntry = await tx.tribeKnowledgeEntry.findFirst({
          where: { entityId: entity.id, content: parsed.data.content, sourceUrl },
          select: { id: true }
        });
        if (duplicateEntry) {
          return { kind: "knowledge" as const, id: duplicateEntry.id, created: false, existingEntity: entity };
        }

        const entry = await tx.tribeKnowledgeEntry.create({
          data: {
            entityId: entity.id,
            content: parsed.data.content,
            sourceUrl,
            status: "UNREVIEWED",
            createdByUserId: context.user.id
          },
          select: { id: true, status: true }
        });
        await tx.auditLog.create({
          data: {
            workspaceId: context.workspaceId,
            actorUserId: context.user.id,
            actor: context.user.email,
            action: "TRIBE_KNOWLEDGE_ENTRY_SUBMITTED",
            targetType: "TribeKnowledgeEntry",
            targetId: entry.id,
            details: JSON.stringify({
              entityId: entity.id,
              status: "UNREVIEWED",
              sourceUrl: sourceUrl ? "provided" : "not_provided"
            })
          }
        });
        return { kind: "knowledge" as const, id: entry.id, created: true, existingEntity: entity };
      }

      // A new name is not published as a shared entity until reviewed.
      const duplicateRequest = await tx.additionRequest.findFirst({
        where: {
          workspaceId: context.workspaceId,
          proposedName: name,
          explanation: parsed.data.content,
          status: "SUBMITTED"
        },
        select: { id: true }
      });
      if (duplicateRequest) {
        return { kind: "request" as const, id: duplicateRequest.id, created: false, existingEntity: null };
      }

      const additionRequest = await tx.additionRequest.create({
        data: {
          workspaceId: context.workspaceId,
          userId: context.user.id,
          entityId: null,
          proposedName: name,
          proposedKind: "TRIBE",
          explanation: parsed.data.content,
          sourceUrl,
          submitter: context.user.email,
          status: "SUBMITTED"
        },
        select: { id: true }
      });
      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.user.id,
          actor: context.user.email,
          action: "TRIBE_ADDITION_REQUEST_SUBMITTED",
          targetType: "AdditionRequest",
          targetId: additionRequest.id,
          details: JSON.stringify({
            proposedName: name,
            existingEntityId: null,
            status: "SUBMITTED",
            sourceUrl: sourceUrl ? "provided" : "not_provided"
          })
        }
      });
      return { kind: "request" as const, id: additionRequest.id, created: true, existingEntity: null };
    });

    const isSharedKnowledge = result.kind === "knowledge";
    return NextResponse.json({
      data: {
        requestId: isSharedKnowledge ? null : result.id,
        knowledgeEntryId: isSharedKnowledge ? result.id : null,
        submittedForReview: true,
        shared: isSharedKnowledge,
        created: result.created,
        existingEntity: result.existingEntity
      },
      message: isSharedKnowledge
        ? result.created
          ? "أُضيفت المعلومة إلى ملف القبيلة المشترك بحالة «غير مراجع». ستظهر لأعضاء المجالس المرتبطة بهذا السجل؛ لا تُعد حقيقة حتى تُراجع."
          : "هذه المعلومة موجودة بالفعل في ملف القبيلة المشترك؛ لم ننشئ نسخة مكررة."
        : result.created
          ? "اسم القبيلة غير موجود في الدليل؛ أُرسل طلب إضافته إلى قائمة المراجعة الخاصة بمجلسك."
          : "هذا الطلب موجود بالفعل في قائمة المراجعة؛ لم ننشئ نسخة مكررة."
    }, { status: result.created ? 201 : 200, headers: NO_STORE });
  } catch (error) {
    console.error("Tribe contribution submission failed", error);
    return NextResponse.json({ error: "تعذر حفظ الطلب أو المعلومة حاليًا." }, { status: 503, headers: NO_STORE });
  }
}
