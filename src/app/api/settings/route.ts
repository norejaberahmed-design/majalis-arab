import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, updatePrivacySettings } from "@/lib/services/users.service";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const user = await getUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  return NextResponse.json({ privacySettings: user.privacySettings });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  try {
    const updated = await updatePrivacySettings(session.user.id, body);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "خطأ" }, { status: 400 });
  }
}
