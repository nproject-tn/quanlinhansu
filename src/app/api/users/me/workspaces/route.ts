import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const memberships = await prisma.companyMember.findMany({
      where: {
        userId: session.user.id,
        company: { isActive: true },
      },
      include: {
        company: true
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(memberships);
  } catch (error: any) {
    console.error("GET /api/users/me/workspaces error:", error);
    return NextResponse.json(
      { error: "Lỗi tải danh sách không gian làm việc" }, 
      { status: 500 }
    );
  }
}
