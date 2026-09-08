import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, updateProfile } from "@/lib/services/users.service";
import { profileSchema } from "@/lib/validations/auth.schema";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  try {
    const updated = await updateProfile(session.user.id, parsed.data);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "حدث خطأ أثناء التحديث" }, { status: 400 });
  }
}
