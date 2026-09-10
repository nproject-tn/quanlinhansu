import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { shiftConfigPeriodUpdateSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";
import { formatDateOnly, parseDateOnly, formatDateVN, formatDateRangeVN } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { error, companyId, user, permissions } = await requireAuth(["OWNER"], {
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

  const existingPeriod = await prisma.shiftConfigPeriod.findFirst({
    where: { id, companyId },
  });
  if (!existingPeriod) {
    return NextResponse.json({ error: "Bảng cấu hình ca không tồn tại" }, { status: 404 });
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = user?.role === "OWNER" || user?.role === "ADMIN" || hasPermission(user?.role || "", permissions, "shift_config", "EDIT_PAST");
  if (!canEditPast && (formatDateOnly(existingPeriod.startDate) < todayStr || (parsed.data.startDate && parsed.data.startDate < todayStr) || formatDateOnly(existingPeriod.endDate) < todayStr || (parsed.data.endDate && parsed.data.endDate < todayStr))) {
    return NextResponse.json({ error: "Lưu không thành công vì bạn không có quyền chỉnh sửa bảng cấu hình ca trong quá khứ." }, { status: 403 });
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

  // Bắt buộc khoảng ngày phải nằm trọn trong 1 tháng duy nhất (không xuyên tháng)
  const newStartStr = formatDateOnly(newStartDate);
  const newEndStr = formatDateOnly(newEndDate);
  if (newStartStr.slice(0, 7) !== newEndStr.slice(0, 7)) {
    return NextResponse.json(
      {
        error: `Khoảng ngày (${formatDateVN(newStartStr)} - ${formatDateVN(newEndStr)}) không hợp lệ. Bảng cấu hình ca phải nằm trọn trong 1 tháng duy nhất, không được chọn xuyên tháng.`,
      },
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

  // Kiểm tra nếu thu hẹp hoặc dịch khoảng ngày khiến có các ca đã xếp rơi ra ngoài
  const orphanedAssignmentsCount = await prisma.shiftAssignment.count({
    where: {
      companyId,
      shiftTemplate: { periodId: id },
      OR: [
        { date: { lt: newStartDate } },
        { date: { gt: newEndDate } },
      ],
    },
  });

  const confirmDeleteAssignments = Boolean(body.confirmDeleteAssignments);
  if (orphanedAssignmentsCount > 0 && !confirmDeleteAssignments) {
    const cutOffParts: string[] = [];
    if (newStartDate > existingPeriod.startDate) {
      const prevEnd = new Date(newStartDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      cutOffParts.push(`${formatDateVN(formatDateOnly(existingPeriod.startDate))} đến ${formatDateVN(formatDateOnly(prevEnd))}`);
    }
    if (newEndDate < existingPeriod.endDate) {
      const nextStart = new Date(newEndDate);
      nextStart.setDate(nextStart.getDate() + 1);
      cutOffParts.push(`${formatDateVN(formatDateOnly(nextStart))} đến ${formatDateVN(formatDateOnly(existingPeriod.endDate))}`);
    }
    const cutOffStr = cutOffParts.length > 0 ? ` (các ngày bị cắt bỏ: ${cutOffParts.join(", ")})` : "";

    return NextResponse.json(
      {
        warning: true,
        requiresConfirmation: true,
        assignmentCount: orphanedAssignmentsCount,
        orphanedCount: orphanedAssignmentsCount,
        cutOffDates: cutOffParts.join(", "),
        message: `Có ${orphanedAssignmentsCount} lượt xếp ca của nhân viên nằm ngoài khoảng ngày mới (${formatDateRangeVN(newStartStr, newEndStr)})${cutOffStr}. Nếu tiếp tục, toàn bộ ${orphanedAssignmentsCount} ca này sẽ bị xóa hoàn toàn khỏi "Lịch xếp ca" để tránh ca vô hình. Bạn có chắc chắn muốn tiếp tục?`,
      },
      { status: 409 }
    );
  }

  // Nếu người dùng đã đồng ý xoá các ca rơi ra ngoài khoảng ngày mới
  if (orphanedAssignmentsCount > 0 && confirmDeleteAssignments) {
    await prisma.shiftAssignment.deleteMany({
      where: {
        companyId,
        shiftTemplate: { periodId: id },
        OR: [
          { date: { lt: newStartDate } },
          { date: { gt: newEndDate } },
        ],
      },
    });

    await prisma.staffingOverride.deleteMany({
      where: {
        companyId,
        shiftTemplate: { periodId: id },
        OR: [
          { date: { lt: newStartDate } },
          { date: { gt: newEndDate } },
        ],
      },
    });
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
        cleanedOrphanedAssignments: orphanedAssignmentsCount,
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
    cleanedAssignmentsCount: orphanedAssignmentsCount,
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const { error, companyId, user, permissions } = await requireAuth(["OWNER"], {
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

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = user?.role === "OWNER" || user?.role === "ADMIN" || hasPermission(user?.role || "", permissions, "shift_config", "EDIT_PAST");
  if (!canEditPast && formatDateOnly(existingPeriod.endDate) < todayStr) {
    return NextResponse.json({ error: "Bạn không có quyền xoá bảng cấu hình ca hoàn toàn trong quá khứ." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let confirmCascade = searchParams.get("confirmCascade") === "true";

  if (!confirmCascade) {
    try {
      const cloned = request.clone();
      const body = await cloned.json();
      if (body?.confirmCascade) confirmCascade = true;
    } catch {
      // ignore
    }
  }

  const assignmentCount = await prisma.shiftAssignment.count({
    where: {
      companyId,
      shiftTemplate: { periodId: id },
    },
  });

  if (assignmentCount > 0 && !confirmCascade) {
    return NextResponse.json(
      {
        warning: true,
        requiresConfirmation: true,
        assignmentCount,
        message: `Bảng cấu hình ca "${existingPeriod.name}" đang có ${assignmentCount} lượt phân công nhân viên trên Lịch xếp ca trong khoảng ngày ${formatDateVN(formatDateOnly(existingPeriod.startDate))} - ${formatDateVN(formatDateOnly(existingPeriod.endDate))}. Nếu bạn xoá bảng này, toàn bộ ${assignmentCount} ca đã xếp sẽ bị xoá hoàn toàn khỏi Lịch xếp ca để tránh lỗi ca vô hình. Bạn có chắc chắn muốn xoá?`,
      },
      { status: 409 }
    );
  }

  // Delete assignments for all templates in this period
  if (assignmentCount > 0) {
    await prisma.shiftAssignment.deleteMany({
      where: {
        companyId,
        shiftTemplate: { periodId: id },
      },
    });
  }

  // Delete staffing overrides for all templates in this period
  await prisma.staffingOverride.deleteMany({
    where: {
      companyId,
      shiftTemplate: { periodId: id },
    },
  });

  // Delete period (cascades to delete shiftTemplates and staffingRules)
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
      description: assignmentCount > 0
        ? `Đã xóa bảng cấu hình ca "${existingPeriod.name}" và làm sạch ${assignmentCount} lượt xếp ca trên lịch`
        : `Đã xóa bảng cấu hình ca "${existingPeriod.name}"`,
    });
  }

  return NextResponse.json({
    success: true,
    message: assignmentCount > 0
      ? `Đã xóa bảng cấu hình ca "${existingPeriod.name}" và làm sạch ${assignmentCount} ca đã xếp tương ứng.`
      : `Đã xóa bảng cấu hình ca "${existingPeriod.name}"`,
    deletedAssignmentsCount: assignmentCount,
  });
}
