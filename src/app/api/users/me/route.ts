import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email && !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: session.user.id
        ? { id: session.user.id }
        : { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        companyId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const emailPrefix = user.email.split("@")[0].toLowerCase();
    const currentName = (user.name || "").trim().toLowerCase();
    
    // User needs onboarding if name is missing or is just the default email prefix
    const needsNameOnboarding = !user.name || currentName === emailPrefix;

    return NextResponse.json({
      user,
      needsNameOnboarding,
    });
  } catch (error: any) {
    console.error("GET /api/users/me error:", error);
    return NextResponse.json(
      { error: "Lỗi tải thông tin tài khoản" },
      { status: 500 }
    );
  }
}
