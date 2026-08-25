import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  const userIdentifier = session?.user?.id || session?.user?.email;

  if (!userIdentifier) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    const cleanName = String(name || "").trim();

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json(
        { error: "Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự)" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: session?.user?.id
        ? { id: session.user.id }
        : { email: session?.user?.email! },
      data: {
        name: cleanName,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("[Update Profile Error]:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi cập nhật thông tin cá nhân" },
      { status: 500 }
    );
  }
}
