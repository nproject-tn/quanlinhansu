import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@/generated/prisma/client";

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }) };
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return {
      error: NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 }),
    };
  }

  return { session };
}
