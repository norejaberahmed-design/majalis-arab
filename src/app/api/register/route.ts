import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validations/auth.schema";
import { createUser } from "@/lib/services/users.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const user = await createUser(parsed.data);
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
