import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyIds } = await request.json();
    
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify ownership for all requested companies
    const memberships = await prisma.companyMember.findMany({
      where: {
        companyId: { in: companyIds },
        userId: session.user.id,
        role: "OWNER",
      },
    });

    if (memberships.length !== companyIds.length) {
      return NextResponse.json({ error: "Bạn không có quyền giải tán một số doanh nghiệp đã chọn" }, { status: 403 });
    }

    // Soft delete companies
    await prisma.company.updateMany({
      where: { id: { in: companyIds } },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/companies/disband error:", error);
    return NextResponse.json(
      { error: "Lỗi hệ thống khi giải tán doanh nghiệp" }, 
      { status: 500 }
    );
  }
}
