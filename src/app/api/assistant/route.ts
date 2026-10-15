import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";
import { runMajalisAI, MajalisAIError } from "@/lib/ai-engine";
import { buildTribeEvidenceContext } from "@/lib/tribe-evidence";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000)
});
const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(8)
}).strict();

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE });
  }

  try {
    const workspace = await getWorkspaceContext(request.headers);
    if (!workspace) {
      return NextResponse.json({ error: "سجّل الدخول واختر مساحة عمل لاستخدام المساعد" }, { status: 401, headers: NO_STORE });
    }

    const body = await readJsonBody(request, 16 * 1024);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers: NO_STORE });
    const parsed = requestSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "أرسل من رسالة إلى 8 رسائل، على ألا تتجاوز كل رسالة 4000 حرف." }, { status: 400, headers: NO_STORE });
    }

    const latestQuestion = [...parsed.data.messages].reverse().find(message => message.role === "user")?.content;
    let evidenceContext: string | undefined;
    if (latestQuestion) {
      try {
        evidenceContext = await buildTribeEvidenceContext(workspace.workspaceId, latestQuestion);
      } catch (error) {
        console.error("Majalis tribal evidence retrieval failed", error instanceof Error ? error.name : "unknown");
        return NextResponse.json({ error: "تعذر قراءة فهرس القبائل ومصادره الآن. حاول مرة أخرى." }, { status: 503, headers: NO_STORE });
      }
    }

    let result;
    try {
      result = await runMajalisAI({ messages: parsed.data.messages, evidenceContext });
    } catch (error) {
      if (error instanceof MajalisAIError) {
        if (error.message === "AI_PROVIDER_NOT_CONFIGURED") {
          return NextResponse.json({ error: "المساعد غير مفعّل بعد. يلزم ضبط OPENAI_API_KEY في إعدادات البيئة." }, { status: 503, headers: NO_STORE });
        }
        if (error.status === 401 || error.status === 403) {
          return NextResponse.json({ error: "تعذر استخدام خدمة المساعد بسبب إعدادات المفتاح." }, { status: 503, headers: NO_STORE });
        }
        if (error.status === 429) {
          return NextResponse.json({ error: "طلبات المساعد كثيرة حاليًا. انتظر قليلًا ثم حاول مجددًا." }, { status: 429, headers: { ...NO_STORE, "Retry-After": "30" } });
        }
        console.error("Majalis assistant provider error", { status: error.status });
        return NextResponse.json({ error: "تعذر الحصول على رد من المساعد حاليًا." }, { status: 502, headers: NO_STORE });
      }
      throw error;
    }

    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error("Majalis assistant request failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "حدث خطأ أثناء معالجة الطلب. حاول مرة أخرى." }, { status: 502, headers: NO_STORE });
  }
}
