import { format } from "date-fns";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { moveAssignment, updateAssignment, type MoveAssignmentInput } from "@/lib/assignment-service";
import { createScheduleApprovalRequest } from "@/lib/schedule-approval";
import { assignmentUpdateSchema } from "@/lib/validations";
import type { Prisma } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";

export async function PUT(request: Request) {
  const { session, permissions, error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  const body = await request.json();
  const parsed = assignmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = session!.user.role === "OWNER" || session!.user.role === "ADMIN" || hasPermission(session!.user.role, permissions, "schedule", "EDIT_PAST");
  if (!canEditPast && parsed.data.date < todayStr) {
    return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa lịch sử ca làm (các ngày trước hôm nay)." }, { status: 403 });
  }

  const isScheduler = !hasPermission(session!.user.role, permissions, "schedule", "EDIT_FREE");
  const result = await updateAssignment({ ...parsed.data, companyId }, isScheduler);

  if (result.status === 202 && result.pendingApproval) {
    const approvalReq = await createScheduleApprovalRequest({
      companyId,
      actionType: "ASSIGN_EMPLOYEE",
      requestedById: session!.user.id,
      payload: { input: parsed.data } as Prisma.InputJsonValue,
      conflicts: result.conflicts ?? [],
      message: "Yêu cầu xác nhận xếp ca vượt giới hạn",
    });

    if ("isDuplicate" in approvalReq && approvalReq.isDuplicate) {
      return NextResponse.json({ error: "Yêu cầu này đã được gửi và đang chờ quản lý duyệt." }, { status: 409 });
    }

    return NextResponse.json(
      {
        success: true,
        pendingApproval: true,
        message: "Đã gửi yêu cầu xác nhận xếp ca",
        conflicts: result.conflicts,
      },
      { status: 202 }
    );
  }

  if ("error" in result && !("success" in result)) {
    return NextResponse.json(result, { status: result.status });
  }

  if (result.success) {
    let empName = "";
    if (parsed.data.employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: parsed.data.employeeId },
        select: { name: true },
      });
      empName = emp?.name || "";
    }

    const shift = await prisma.shiftTemplate.findUnique({
      where: { id: parsed.data.shiftTemplateId },
      select: {
        name: true,
        startTime: true,
        endTime: true,
        store: { select: { name: true } },
      },
    });

    const storeName = shift?.store?.name || "Cửa hàng";
    const shiftDesc = shift ? `${shift.name} (${shift.startTime} - ${shift.endTime})` : "Ca làm việc";

    await logActivity({
      companyId,
      userId: session!.user.id,
      userName: session!.user.name,
      userEmail: session!.user.email,
      userRole: session!.user.role,
      action: "UPDATE",
      module: "schedule",
      targetType: "ShiftAssignment",
      targetName: empName || shiftDesc,
      description: empName
        ? `Đã xếp nhân viên ${empName} vào ${shiftDesc} tại ${storeName} ngày ${parsed.data.date}`
        : `Đã làm trống / xoá nhân viên khỏi ${shiftDesc} tại ${storeName} ngày ${parsed.data.date}`,
      details: {
        "Nhân viên": empName || "Làm trống ca",
        "Cửa hàng": storeName,
        "Ca làm việc": shiftDesc,
        "Ngày làm việc": parsed.data.date,
        "Vị trí ca": `Vị trí ${parsed.data.slotIndex + 1}`,
      },
    });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { session, permissions, error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  const body = await request.json();
  const isScheduler = !hasPermission(session!.user.role, permissions, "schedule", "EDIT_FREE");

  const input: MoveAssignmentInput = {
    sourceStoreId: String(body.sourceStoreId ?? ""),
    sourceShiftTemplateId: String(body.sourceShiftTemplateId ?? ""),
    sourceDate: String(body.sourceDate ?? ""),
    sourceSlotIndex: Number(body.sourceSlotIndex),
    targetStoreId: String(body.targetStoreId ?? ""),
    targetShiftTemplateId: String(body.targetShiftTemplateId ?? ""),
    targetDate: String(body.targetDate ?? ""),
    targetSlotIndex: Number(body.targetSlotIndex),
    targetRequiredStaff: Number(body.targetRequiredStaff),
    companyId,
    confirmOverCapacity:
      isScheduler ? false : Boolean(body.confirmOverCapacity),
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = session!.user.role === "OWNER" || session!.user.role === "ADMIN" || hasPermission(session!.user.role, permissions, "schedule", "EDIT_PAST");
  if (!canEditPast && (input.sourceDate < todayStr || input.targetDate < todayStr)) {
    return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa lịch sử ca làm (các ngày trước hôm nay)." }, { status: 403 });
  }

  const result = await moveAssignment(input, isScheduler);

  if (result.status === 202 && result.pendingApproval) {
    const approvalReq = await createScheduleApprovalRequest({
      companyId,
      actionType: "MOVE_ASSIGNMENT",
      requestedById: session!.user.id,
      payload: input as unknown as Prisma.InputJsonValue,
      conflicts: result.conflicts ?? [],
      message: "Yêu cầu xác nhận đổi ca vượt giới hạn",
    });

    if ("isDuplicate" in approvalReq && approvalReq.isDuplicate) {
      return NextResponse.json({ error: "Yêu cầu này đã được gửi và đang chờ quản lý duyệt." }, { status: 409 });
    }

    return NextResponse.json(
      {
        success: true,
        pendingApproval: true,
        message: "Đã gửi yêu cầu xác nhận đổi ca",
        conflicts: result.conflicts,
      },
      { status: 202 }
    );
  }

  if ("error" in result && !("success" in result)) {
    return NextResponse.json(result, { status: result.status });
  }

  if (result.success) {
    const [sourceStore, targetStore, sourceShift, targetShift] = await Promise.all([
      prisma.store.findUnique({ where: { id: input.sourceStoreId }, select: { name: true } }),
      prisma.store.findUnique({ where: { id: input.targetStoreId }, select: { name: true } }),
      prisma.shiftTemplate.findUnique({ where: { id: input.sourceShiftTemplateId }, select: { name: true, startTime: true, endTime: true } }),
      prisma.shiftTemplate.findUnique({ where: { id: input.targetShiftTemplateId }, select: { name: true, startTime: true, endTime: true } }),
    ]);

    const srcStoreName = sourceStore?.name || "Cửa hàng nguồn";
    const tgtStoreName = targetStore?.name || "Cửa hàng đích";
    const srcShiftName = sourceShift ? `${sourceShift.name} (${sourceShift.startTime} - ${sourceShift.endTime})` : "Ca nguồn";
    const tgtShiftName = targetShift ? `${targetShift.name} (${targetShift.startTime} - ${targetShift.endTime})` : "Ca đích";

    await logActivity({
      companyId,
      userId: session!.user.id,
      userName: session!.user.name,
      userEmail: session!.user.email,
      userRole: session!.user.role,
      action: "UPDATE",
      module: "schedule",
      targetType: "ShiftAssignment",
      targetName: `${srcShiftName} ➔ ${tgtShiftName}`,
      description: `Đã đổi / chuyển ca từ ${srcShiftName} (${srcStoreName}, ${input.sourceDate}) sang ${tgtShiftName} (${tgtStoreName}, ${input.targetDate})`,
      details: {
        "Từ cửa hàng": srcStoreName,
        "Từ ca": srcShiftName,
        "Từ ngày": input.sourceDate,
        "Từ vị trí": `Vị trí ${input.sourceSlotIndex + 1}`,
        "Đến cửa hàng": tgtStoreName,
        "Đến ca": tgtShiftName,
        "Đến ngày": input.targetDate,
        "Đến vị trí": `Vị trí ${input.targetSlotIndex + 1}`,
      },
    });
  }

  return NextResponse.json({
    success: result.success,
    message: result.message,
  });
}
