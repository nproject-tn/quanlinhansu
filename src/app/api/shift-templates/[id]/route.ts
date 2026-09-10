import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { shiftTemplateSchema } from "@/lib/validations";
import { calcDurationHours, getShiftContainmentError } from "@/lib/shift-utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { formatDateOnly } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { error, companyId, user, session, permissions } = await requireAuth(["OWNER"], { module: "shift_config", action: "EDIT" });
  if (error || !companyId) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = shiftTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingTemplate = await prisma.shiftTemplate.findUnique({
    where: { id, companyId },
    include: { period: { select: { startDate: true, endDate: true } } },
  });
  if (!existingTemplate) {
    return NextResponse.json({ error: "Ca không tồn tại hoặc không có quyền truy cập" }, { status: 404 });
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = user?.role === "OWNER" || user?.role === "ADMIN" || hasPermission(user?.role || "", permissions, "shift_config", "EDIT_PAST");
  if (!canEditPast && existingTemplate.period?.endDate && formatDateOnly(existingTemplate.period.endDate) < todayStr) {
    return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa ca làm việc thuộc bảng cấu hình trong quá khứ." }, { status: 403 });
  }

  const effectivePeriodId = parsed.data.periodId !== undefined ? parsed.data.periodId : existingTemplate.periodId;
  const scopeCondition = effectivePeriodId
    ? { periodId: effectivePeriodId }
    : { storeId: parsed.data.storeId, periodId: null };

  // Kiểm tra tên ca có bị trùng trong cùng bảng cấu hình không
  const existingActiveShift = await prisma.shiftTemplate.findFirst({
    where: {
      companyId,
      ...scopeCondition,
      name: parsed.data.name,
      isActive: true,
      id: { not: id }, // Bỏ qua chính ca đang cập nhật
    },
  });

  if (existingActiveShift) {
    return NextResponse.json(
      { error: "Tên ca này đã tồn tại trong bảng cấu hình, vui lòng chọn tên khác." },
      { status: 400 }
    );
  }

  // Kiểm tra khung giờ ca có bị trùng hệt hoặc nằm lọt lòng trong ca khác cùng bảng không
  const activeStoreShifts = await prisma.shiftTemplate.findMany({
    where: {
      companyId,
      ...scopeCondition,
      isActive: true,
      id: { not: id }, // Bỏ qua chính ca đang cập nhật
    },
    select: { id: true, name: true, startTime: true, endTime: true },
  });

  for (const existing of activeStoreShifts) {
    const errorMsg = getShiftContainmentError(
      { startTime: parsed.data.startTime, endTime: parsed.data.endTime },
      existing
    );
    if (errorMsg) {
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
  }

  const durationHours = calcDurationHours(parsed.data.startTime, parsed.data.endTime);

  const template = await prisma.shiftTemplate.update({
    where: { id },
    data: { ...parsed.data, durationHours },
  });

  const { syncStoreShifts } = await import("@/lib/api-shift-utils");
  await syncStoreShifts(template.storeId);

  if (user) {
    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "UPDATE",
      module: "shift_config",
      targetType: "ShiftTemplate",
      targetId: template.id,
      targetName: template.name,
      description: `Đã cập nhật ca làm việc: ${template.name} (${template.startTime} - ${template.endTime})`,
      details: {
        name: template.name,
        startTime: template.startTime,
        endTime: template.endTime,
        durationHours: template.durationHours,
      },
    });
  }

  return NextResponse.json(template);
}

export async function DELETE(request: Request, { params }: Params) {
  const { error, companyId, user, permissions } = await requireAuth(["OWNER"], { module: "shift_config", action: "EDIT" });
  if (error || !companyId) return error;

  const { id } = await params;

  const shiftTemplate = await prisma.shiftTemplate.findUnique({
    where: { id, companyId },
    include: { period: { select: { startDate: true, endDate: true } } },
  });
  if (!shiftTemplate) {
    return NextResponse.json({ error: "Ca không tồn tại hoặc không có quyền truy cập" }, { status: 404 });
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = user?.role === "OWNER" || user?.role === "ADMIN" || hasPermission(user?.role || "", permissions, "shift_config", "EDIT_PAST");
  if (!canEditPast && shiftTemplate.period?.endDate && formatDateOnly(shiftTemplate.period.endDate) < todayStr) {
    return NextResponse.json({ error: "Bạn không có quyền xoá ca làm việc thuộc bảng cấu hình trong quá khứ." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let confirmCascade = searchParams.get("confirmCascade") === "true";

  // Also check if body has confirmCascade (e.g. from JSON body)
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
    where: { shiftTemplateId: id },
  });

  if (assignmentCount > 0 && !confirmCascade) {
    return NextResponse.json(
      {
        warning: true,
        requiresConfirmation: true,
        assignmentCount,
        message: `Ca "${shiftTemplate.name}" đang có ${assignmentCount} lượt phân công nhân viên trên Lịch xếp ca. Nếu bạn xoá ca này, toàn bộ ${assignmentCount} ca đã xếp sẽ bị xoá hoàn toàn khỏi Lịch xếp ca để tránh lỗi ca vô hình. Bạn có chắc chắn muốn xoá?`,
      },
      { status: 409 }
    );
  }

  // Delete all assignments and staffing rules/overrides
  if (assignmentCount > 0) {
    await prisma.shiftAssignment.deleteMany({ where: { shiftTemplateId: id } });
  }
  await prisma.staffingRule.deleteMany({ where: { shiftTemplateId: id } });
  await prisma.staffingOverride.deleteMany({ where: { shiftTemplateId: id } });
  
  // HARD DELETE: permanently delete template to avoid ghost records
  await prisma.shiftTemplate.delete({ where: { id } });

  const { syncStoreShifts } = await import("@/lib/api-shift-utils");
  await syncStoreShifts(shiftTemplate.storeId);

  if (user) {
    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "DELETE",
      module: "shift_config",
      targetType: "ShiftTemplate",
      targetId: shiftTemplate.id,
      targetName: shiftTemplate.name,
      description: assignmentCount > 0
        ? `Đã xoá ca làm việc ${shiftTemplate.name} và làm sạch ${assignmentCount} ca đã xếp trên lịch`
        : `Đã xoá vĩnh viễn ca làm việc ${shiftTemplate.name}`,
    });
  }

  return NextResponse.json({
    success: true,
    message: assignmentCount > 0
      ? `Đã xoá ca "${shiftTemplate.name}" và làm sạch ${assignmentCount} lượt xếp ca tương ứng.`
      : `Đã xoá ca "${shiftTemplate.name}".`,
    deletedAssignmentsCount: assignmentCount,
  });
}
