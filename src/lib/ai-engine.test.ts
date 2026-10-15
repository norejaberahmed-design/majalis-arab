import { afterEach, describe, expect, it, vi } from "vitest";
import { MajalisAIError, runMajalisAI } from "./ai-engine";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("central Majalis AI engine", () => {
  it("fails clearly when the provider key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(runMajalisAI({ messages: [{ role: "user", content: "مرحبا" }] }))
      .rejects.toMatchObject({ name: "MajalisAIError", status: 503, message: "AI_PROVIDER_NOT_CONFIGURED" });
  });

  it("sends conversation without persistence and returns provider output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ output_text: "الإجابة التجريبية" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runMajalisAI({ messages: [{ role: "user", content: "لخص النص" }] }))
      .resolves.toEqual({ answer: "الإجابة التجريبية", model: "test-model" });

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.body).toContain('"store":false');
    expect(options.body).toContain("MAJALIS");
  });

  it("marks retrieved evidence as data, not instructions", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ output_text: "توجد رواية في المصدر." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await runMajalisAI({
      messages: [{ role: "user", content: "ماذا يقول المصدر؟" }],
      evidenceContext: "المصدر: كتاب تاريخي، صفحة 12",
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.instructions).toContain("<evidence_context>");
    expect(body.instructions).toContain("كتاب تاريخي، صفحة 12");
    expect(body.instructions).toContain("لا تخترع مصدرًا");
  });

  it("converts provider failures into typed errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    await expect(runMajalisAI({ messages: [{ role: "user", content: "سؤال" }] }))
      .rejects.toBeInstanceOf(MajalisAIError);
  });
});
