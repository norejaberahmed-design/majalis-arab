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
    return NextResponse.json({ error: "سجّل الدخول قبل إرسال اسم قبيلة أو معلومات عنها" }, { status: 401, headers: NO_STORE });
  }

  const body = await readJsonBody(request, 20_000);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
  const parsed = inputSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل اسم القبيلة ومعلومات لا تقل عن 10 أحرف، ويمكن إضافة رابط مصدر." }, { status: 400, headers: NO_STORE });
  }

  const name = parsed.data.name.replace(/\\s+/g, " ");
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

      // A user-submitted name must never create a shared catalogue entity by itself.
      // New names enter the workspace-scoped review queue instead.
      if (!entity) {
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
          return { kind: "request" as const, requestId: duplicateRequest.id, created: false };
        }

        const additionRequest = await tx.additionRequest.create({
          data: {
            workspaceId: context.workspaceId,
            userId: context.user.id,
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
            details: JSON.stringify({ proposedName: name, status: "SUBMITTED", sourceUrl: sourceUrl ? "provided" : "not_provided" })
          }
        });
        return { kind: "request" as const, requestId: additionRequest.id, created: true };
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
          action: entryCreated ? "SHARED_TRIBE_KNOWLEDGE_ADDED" : "SHARED_TRIBE_KNOWLEDGE_DUPLICATE",
          targetType: "TribeKnowledgeEntry",
          targetId: entry.id,
          details: JSON.stringify({ entityId: entity.id, status: "UNREVIEWED", sourceUrl: sourceUrl ? "provided" : "not_provided" })
        }
      });
      return { kind: "knowledge" as const, entity, entryId: entry.id, entryCreated };
    });

    if (result.kind === "request") {
      return NextResponse.json({
        data: { requestId: result.requestId, submittedForReview: true, created: result.created },
        message: result.created
          ? "أُرسل اسم القبيلة ومعلوماتها إلى قائمة المراجعة. لن يظهر سجل قبلي مشترك حتى تتم مراجعته واعتماده."
          : "هذا الطلب موجود بالفعل في قائمة المراجعة؛ لم ننشئ نسخة مكررة."
      }, { status: result.created ? 201 : 200, headers: NO_STORE });
    }

    return NextResponse.json({
      data: { ...result.entity, entryId: result.entryId, created: false, entryCreated: result.entryCreated, submittedForReview: false },
      message: result.entryCreated
        ? "القبيلة موجودة بالفعل؛ أضفنا مساهمتك إلى سجلها المشترك، وهي بانتظار المراجعة."
        : "القبيلة وهذه المعلومة مسجلتان بالفعل؛ لم ننشئ نسخة مكررة."
    }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("Tribe contribution submission failed", error);
    return NextResponse.json({ error: "تعذر حفظ الطلب أو المعلومة حاليًا." }, { status: 503, headers: NO_STORE });
  }
}
