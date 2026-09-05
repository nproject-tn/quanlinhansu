import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { shiftConfigPeriodUpdateSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";
import { formatDateOnly, parseDateOnly, formatDateVN } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { error, companyId, user } = await requireAuth(["OWNER"], {
    module: "shift_config",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = shiftConfigPeriodUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingPeriod = await prisma.shiftConfigPeriod.findUnique({
    where: { id, companyId },
  });
  if (!existingPeriod) {
    return NextResponse.json({ error: "Bảng cấu hình ca không tồn tại" }, { status: 404 });
  }

  const newStartDate = parsed.data.startDate
    ? parseDateOnly(parsed.data.startDate)
    : existingPeriod.startDate;
  const newEndDate = parsed.data.endDate
    ? parseDateOnly(parsed.data.endDate)
    : existingPeriod.endDate;

  if (newStartDate > newEndDate) {
    return NextResponse.json(
      { error: "Ngày bắt đầu không được lớn hơn ngày kết thúc." },
      { status: 400 }
    );
  }

  // Kiểm tra chống trùng ngày với các bảng cấu hình khác của cửa hàng
  const overlapping = await prisma.shiftConfigPeriod.findFirst({
    where: {
      companyId,
      storeId: existingPeriod.storeId,
      id: { not: id },
      startDate: { lte: newEndDate },
      endDate: { gte: newStartDate },
    },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  if (overlapping) {
    return NextResponse.json(
      {
        error: `Khoảng ngày ${formatDateVN(formatDateOnly(newStartDate))} - ${formatDateVN(formatDateOnly(newEndDate))} không hợp lệ vì bị trùng ngày với bảng cấu hình "${overlapping.name}" (${formatDateVN(formatDateOnly(overlapping.startDate))} - ${formatDateVN(formatDateOnly(overlapping.endDate))}) của cửa hàng.`,
      },
      { status: 400 }
    );
  }

  const updated = await prisma.shiftConfigPeriod.update({
    where: { id },
    data: {
      name: parsed.data.name ?? existingPeriod.name,
      startDate: newStartDate,
      endDate: newEndDate,
    },
    include: {
      shiftTemplates: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      store: { select: { id: true, name: true, logoUrl: true } },
    },
  });

  if (user) {
    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "UPDATE",
      module: "shift_config",
      targetType: "ShiftConfigPeriod",
      targetId: id,
      targetName: updated.name,
      description: `Đã cập nhật bảng cấu hình ca "${updated.name}" (${formatDateVN(formatDateOnly(newStartDate))} - ${formatDateVN(formatDateOnly(newEndDate))})`,
      details: {
        oldStartDate: formatDateOnly(existingPeriod.startDate),
        oldEndDate: formatDateOnly(existingPeriod.endDate),
        newStartDate: formatDateOnly(newStartDate),
        newEndDate: formatDateOnly(newEndDate),
      },
    });
  }

  return NextResponse.json({
    success: true,
    period: {
      ...updated,
      startDate: formatDateOnly(updated.startDate),
      endDate: formatDateOnly(updated.endDate),
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error, companyId, user } = await requireAuth(["OWNER"], {
    module: "shift_config",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  const { id } = await params;
  const existingPeriod = await prisma.shiftConfigPeriod.findUnique({
    where: { id, companyId },
  });
  if (!existingPeriod) {
    return NextResponse.json({ error: "Bảng cấu hình ca không tồn tại" }, { status: 404 });
  }

  await prisma.shiftConfigPeriod.delete({
    where: { id },
  });

  if (user) {
    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "DELETE",
      module: "shift_config",
      targetType: "ShiftConfigPeriod",
      targetId: id,
      targetName: existingPeriod.name,
      description: `Đã xóa bảng cấu hình ca "${existingPeriod.name}"`,
    });
  }

  return NextResponse.json({
    success: true,
    message: `Đã xóa bảng cấu hình ca "${existingPeriod.name}"`,
  });
}
