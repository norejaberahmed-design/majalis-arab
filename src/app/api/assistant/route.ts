import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext, hasTrustedOrigin } from "@/lib/workspace";
import { readJsonBody } from "@/lib/http";
import { MAJALIS_AGENT_INSTRUCTIONS } from "@/lib/agent-instructions";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000)
});
const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(8)
}).strict();

function responseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { output_text?: unknown; output?: unknown };
  if (typeof root.output_text === "string" && root.output_text.trim()) return root.output_text.trim();
  if (!Array.isArray(root.output)) return null;
  const chunks: string[] = [];
  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: unknown }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") {
        chunks.push((part as { text: string }).text);
      }
    }
  }
  const result = chunks.join("\n").trim();
  return result || null;
}

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "المساعد غير مفعّل بعد. يلزم ضبط OPENAI_API_KEY في إعدادات البيئة." }, { status: 503, headers: NO_STORE });
    }

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
    const conversation = parsed.data.messages.map(message => ({ role: message.role, content: message.content }));
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: MAJALIS_AGENT_INSTRUCTIONS,
        input: conversation,
        max_output_tokens: 900,
        store: false
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store"
    });

    if (!upstream.ok) {
      const status = upstream.status;
      console.error("Majalis assistant provider returned an error", { status });
      if (status === 401 || status === 403) {
        return NextResponse.json({ error: "تعذر استخدام خدمة المساعد بسبب إعدادات المفتاح." }, { status: 503, headers: NO_STORE });
      }
      if (status === 429) {
        return NextResponse.json({ error: "طلبات المساعد كثيرة حاليًا. انتظر قليلًا ثم حاول مجددًا." }, { status: 429, headers: { ...NO_STORE, "Retry-After": "30" } });
      }
      return NextResponse.json({ error: "تعذر الحصول على رد من المساعد حاليًا." }, { status: 502, headers: NO_STORE });
    }

    const payload: unknown = await upstream.json();
    const answer = responseText(payload);
    if (!answer) {
      return NextResponse.json({ error: "وصل رد غير مكتمل من خدمة المساعد. حاول مرة أخرى." }, { status: 502, headers: NO_STORE });
    }

    return NextResponse.json({ answer, model }, { headers: NO_STORE });
  } catch (error) {
    console.error("Majalis assistant request failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "حدث خطأ أثناء معالجة الطلب. حاول مرة أخرى." }, { status: 502, headers: NO_STORE });
  }
}
