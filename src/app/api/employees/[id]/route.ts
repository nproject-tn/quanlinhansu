import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { employeeSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "employees", action: "VIEW" });
  if (error) return error;

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id, companyId },
    include: {
      stores: {
        where: { store: { isActive: true } },
        include: { store: true }
      }
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  return NextResponse.json(employee);
}

export async function PUT(request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "employees", action: "EDIT" });
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  if (body.restore) {
    const employee = await prisma.employee.update({
      where: { id, companyId },
      data: { deletedAt: null, isActive: true, isArchived: false },
      include: {
      stores: {
        where: { store: { isActive: true } },
        include: { store: true }
      }
    },
    });
    return NextResponse.json(employee);
  }

  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeIds, ...data } = parsed.data;

  await prisma.employeeStore.deleteMany({ where: { employeeId: id, store: { companyId } } });

  const employee = await prisma.employee.update({
    where: { id, companyId },
    data: {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      stores: {
        create: storeIds.map((storeId) => ({ storeId })),
      },
    },
    include: {
      stores: {
        where: { store: { isActive: true } },
        include: { store: true }
      }
    },
  });

  return NextResponse.json(employee);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "employees", action: "DELETE" });
  if (error) return error;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id, companyId } });
  if (!employee) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  if (employee.deletedAt == null) {
    // Soft Delete and unassign future shifts (from tomorrow onwards in UTC+7)
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 7);
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    // Vacate future shifts
    await prisma.shiftAssignment.updateMany({
      where: {
        companyId,
        employeeId: id,
        date: { gte: tomorrow },
      },
      data: { employeeId: null },
    });

    await prisma.employee.update({
      where: { id, companyId },
      data: { deletedAt: new Date(), isActive: false },
    });

    if (employee.email) {
      await prisma.companyInvitation.deleteMany({
        where: { email: employee.email, companyId: employee.companyId }
      });
    }

    return NextResponse.json({
      success: true,
      message: "Nhân viên đã được đưa vào danh sách đã nghỉ. Các ca làm từ ngày mai đã được làm trống.",
      softDeleted: true,
    });
  } else {
    // Archive (Permanently Hide from UI, but preserve history & past shift assignments)
    await prisma.user.updateMany({ where: { employeeId: id }, data: { employeeId: null } });
    await prisma.employee.update({ where: { id, companyId }, data: { isArchived: true, isActive: false } });
    
    if (employee.email) {
      await prisma.companyInvitation.deleteMany({
        where: { email: employee.email, companyId: employee.companyId }
      });
    }
    return NextResponse.json({ success: true, message: "Đã ẩn vĩnh viễn nhân viên khỏi danh sách nhưng vẫn lưu trữ lịch sử ca làm" });
  }
}
