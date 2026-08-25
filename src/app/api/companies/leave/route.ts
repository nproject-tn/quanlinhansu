import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: "Thiếu ID doanh nghiệp" }, { status: 400 });
    }

    // Resolve target company by id or slug
    const company = await prisma.company.findFirst({
      where: {
        OR: [
          { id: companyId },
          { name: companyId }
        ]
      },
      select: { id: true, name: true }
    });

    if (!company) {
      return NextResponse.json({ error: "Không tìm thấy doanh nghiệp" }, { status: 404 });
    }

    const actualCompanyId = company.id;

    // Check membership
    const membership = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: session.user.id,
          companyId: actualCompanyId,
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Bạn không phải thành viên của doanh nghiệp này" }, { status: 404 });
    }

    // Block Owner from self-leaving without transferring
    if (membership.role === "OWNER") {
      return NextResponse.json({ 
        error: "Chủ sở hữu không thể tự rời doanh nghiệp. Vui lòng chuyển giao quyền Chủ sở hữu trước hoặc giải tán doanh nghiệp." 
      }, { status: 400 });
    }

    // 1. Delete CompanyMember
    await prisma.companyMember.delete({
      where: { id: membership.id }
    });

    // 2. Clear legacy user.companyId if matching
    await prisma.user.updateMany({
      where: {
        id: session.user.id,
        companyId: actualCompanyId,
      },
      data: {
        companyId: null,
      }
    });

    // 3. Clear any invitations for this user in this company
    if (session.user.email) {
      await prisma.companyInvitation.deleteMany({
        where: {
          companyId: actualCompanyId,
          email: session.user.email,
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Đã rời khỏi doanh nghiệp ${company.name} thành công` 
    });
  } catch (err: any) {
    console.error("POST /api/companies/leave error:", err);
    return NextResponse.json({ error: "Lỗi khi rời doanh nghiệp: " + err.message }, { status: 500 });
  }
}
