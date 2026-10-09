import { NextRequest } from "next/server";

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

export async function readJsonBody(
  request: NextRequest,
  maxBytes = 16 * 1024
): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, status: 415, error: "يجب إرسال البيانات بصيغة JSON" };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return { ok: false, status: 413, error: "حجم الطلب أكبر من الحد المسموح" };
    }
  }

  if (!request.body) {
    return { ok: false, status: 400, error: "جسم الطلب فارغ" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "حجم الطلب أكبر من الحد المسموح" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "تعذر قراءة الطلب" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, data: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false, status: 400, error: "صيغة JSON غير صحيحة" };
  }
}
