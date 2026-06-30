import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { employeeSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { stores: { include: { store: true } } },
  });

  if (!employee) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  return NextResponse.json(employee);
}

export async function PUT(request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeIds, ...data } = parsed.data;

  await prisma.employeeStore.deleteMany({ where: { employeeId: id } });

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      stores: {
        create: storeIds.map((storeId) => ({ storeId })),
      },
    },
    include: { stores: { include: { store: true } } },
  });

  return NextResponse.json(employee);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;

  const assignmentCount = await prisma.shiftAssignment.count({
    where: { employeeId: id },
  });

  if (assignmentCount > 0) {
    await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({
      success: true,
      message: "Nhân viên đã có lịch xếp — đã ẩn thay vì xóa hẳn",
      softDeleted: true,
    });
  }

  await prisma.user.updateMany({ where: { employeeId: id }, data: { employeeId: null } });
  await prisma.employee.delete({ where: { id } });

  return NextResponse.json({ success: true, message: "Đã xóa nhân viên" });
}
