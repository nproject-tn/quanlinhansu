import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action } = await request.json();
    if (action !== "RESTORE") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const company = await prisma.company.update({
      where: { id: params.id },
      data: { isActive: true },
    });

    return NextResponse.json({ success: true, company });
  } catch (error) {
    console.error("PUT /api/admin/companies/[id] error:", error);
    return NextResponse.json({ error: "Lỗi khôi phục doanh nghiệp" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Perform cascading hard delete
    await prisma.$transaction([
      // Delete relationships (Prisma might handle this automatically if configured with cascading deletes, 
      // but if not, we do it manually to be safe)
      prisma.companyMember.deleteMany({ where: { companyId: params.id } }),
      prisma.store.deleteMany({ where: { companyId: params.id } }),
      prisma.employee.deleteMany({ where: { companyId: params.id } }),
      prisma.shiftTemplate.deleteMany({ where: { companyId: params.id } }),
      prisma.staffingRule.deleteMany({ where: { companyId: params.id } }),
      prisma.scheduleConfig.deleteMany({ where: { companyId: params.id } }),
      prisma.scheduleDayNote.deleteMany({ where: { companyId: params.id } }),
      prisma.companyInvitation.deleteMany({ where: { companyId: params.id } }),
      
      // Delete main company record
      prisma.company.delete({ where: { id: params.id } })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/companies/[id] error:", error);
    return NextResponse.json({ error: "Lỗi xóa vĩnh viễn doanh nghiệp" }, { status: 500 });
  }
}
