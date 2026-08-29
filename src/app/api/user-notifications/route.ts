import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const { error, session, user, companyId } = await requireAuth();
  if (error) return error;

  try {
    const notifications = await prisma.userNotification.findMany({
      where: {
        companyId,
        userId: user.id,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    const unreadCount = await prisma.userNotification.count({
      where: {
        companyId,
        userId: user.id,
        read: false,
      },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (err: any) {
    console.error("GET /api/user-notifications error:", err);
    return NextResponse.json(
      { error: "Không tải được thông báo" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { error, user, companyId } = await requireAuth();
  if (error) return error;

  try {
    await prisma.userNotification.deleteMany({
      where: {
        companyId,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Không thể xoá thông báo" },
      { status: 500 }
    );
  }
}
