import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createScheduleApprovalRequest } from "@/lib/schedule-approval";
import type { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { session, error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { hours } = body;

  if (hours == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // If SCHEDULER, require approval
  if (session!.user.role === "SCHEDULER") {
    const existing = await prisma.shiftOvertime.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await createScheduleApprovalRequest({
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
  const { session, error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { id } = await params;

  // If SCHEDULER, require approval
  if (session!.user.role === "SCHEDULER") {
    const existing = await prisma.shiftOvertime.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await createScheduleApprovalRequest({
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
      message: "Yêu cầu xác nhận xóa giờ làm thêm",
    });

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
