import { NextResponse } from "next/server";
import { format } from "date-fns";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createScheduleApprovalRequest } from "@/lib/schedule-approval";
import type { Prisma } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import { formatDateOnly } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { session, permissions, error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  const { id } = await params;
  const body = await request.json();
  const { hours } = body;

  if (hours == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.shiftOvertime.findUnique({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = session!.user.role === "OWNER" || session!.user.role === "ADMIN" || hasPermission(session!.user.role, permissions, "schedule", "EDIT_PAST");
  if (!canEditPast && formatDateOnly(existing.date) < todayStr) {
    return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa giờ làm thêm trong quá khứ." }, { status: 403 });
  }

  // If SCHEDULER, require approval
  if (session!.user.role === "SCHEDULER") {
    const approvalReq = await createScheduleApprovalRequest({
      companyId,
      actionType: "UPDATE_OVERTIME",
      requestedById: session!.user.id,
      payload: { 
        id, 
        hours, 
        employeeId: existing.employeeId, 
        date: existing.date, 
        storeId: existing.storeId, 
        shiftTemplateId: existing.shiftTemplateId 
      } as Prisma.InputJsonValue,
      conflicts: [],
      message: "Yêu cầu xác nhận cập nhật giờ làm thêm",
    });

    if ("isDuplicate" in approvalReq && approvalReq.isDuplicate) {
      return NextResponse.json({ error: "Yêu cầu này đã được gửi và đang chờ quản lý duyệt." }, { status: 409 });
    }

    return NextResponse.json(
      { success: true, pendingApproval: true, message: "Đã gửi yêu cầu xác nhận cập nhật giờ làm thêm" },
      { status: 202 }
    );
  }

  // If ADMIN, update directly
  try {
    const overtime = await prisma.shiftOvertime.update({
      where: { id },
      data: { hours: Number(hours) },
    });
    return NextResponse.json(overtime);
  } catch (dbError) {
    console.error("PUT /api/schedule/overtime/[id] failed", dbError);
    return NextResponse.json({ error: "Failed to update overtime" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { session, permissions, error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  const { id } = await params;

  const existing = await prisma.shiftOvertime.findUnique({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = session!.user.role === "OWNER" || session!.user.role === "ADMIN" || hasPermission(session!.user.role, permissions, "schedule", "EDIT_PAST");
  if (!canEditPast && formatDateOnly(existing.date) < todayStr) {
    return NextResponse.json({ error: "Bạn không có quyền xoá giờ làm thêm trong quá khứ." }, { status: 403 });
  }

  // If SCHEDULER, require approval
  if (session!.user.role === "SCHEDULER") {
    const approvalReq = await createScheduleApprovalRequest({
      companyId,
      actionType: "DELETE_OVERTIME",
      requestedById: session!.user.id,
      payload: { 
        id, 
        employeeId: existing.employeeId, 
        date: existing.date, 
        storeId: existing.storeId, 
        shiftTemplateId: existing.shiftTemplateId 
      } as Prisma.InputJsonValue,
      conflicts: [],
      message: "Yêu cầu xác nhận xoá giờ làm thêm",
    });

    if ("isDuplicate" in approvalReq && approvalReq.isDuplicate) {
      return NextResponse.json({ error: "Yêu cầu này đã được gửi và đang chờ quản lý duyệt." }, { status: 409 });
    }

    return NextResponse.json(
      { success: true, pendingApproval: true, message: "Đã gửi yêu cầu xác nhận xóa giờ làm thêm" },
      { status: 202 }
    );
  }

  // If ADMIN, delete directly
  try {
    await prisma.shiftOvertime.delete({
      where: { id },
    });
    return NextResponse.json({ success: true, message: "Đã xóa giờ làm thêm" });
  } catch (dbError) {
    console.error("DELETE /api/schedule/overtime/[id] failed", dbError);
    return NextResponse.json({ error: "Failed to delete overtime" }, { status: 500 });
  }
}
