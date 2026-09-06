import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeUserStatus } from "@/lib/services/users.service";
import { UserStatus } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "ممنوع" }, { status: 403 });

  const { userId } = await params;
  const body = await req.json();
  const status = body.status as UserStatus;

  try {
    const updated = await changeUserStatus(session.user.id, session.user.role, userId, status, body.reason);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "خطأ" }, { status: 400 });
  }
}
