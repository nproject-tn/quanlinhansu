import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request: Request) {
  const { error, user, companyId } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const { notificationId } = body;

    if (notificationId) {
      await prisma.userNotification.updateMany({
        where: {
          id: notificationId,
          companyId,
          userId: user.id,
        },
        data: {
          read: true,
        },
      });
    } else {
      // Mark all as read
      await prisma.userNotification.updateMany({
        where: {
          companyId,
          userId: user.id,
          read: false,
        },
        data: {
          read: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/user-notifications/mark-read error:", err);
    return NextResponse.json(
      { error: "Không cập nhật được trạng thái thông báo" },
      { status: 500 }
    );
  }
}
