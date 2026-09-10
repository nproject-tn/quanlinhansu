import { NextResponse } from "next/server";
import { format } from "date-fns";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createScheduleApprovalRequest } from "@/lib/schedule-approval";
import type { Prisma } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";

export async function POST(request: Request) {
  const { session, permissions, error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  const body = await request.json();
  const { storeId, shiftTemplateId, date, employeeId, hours } = body;

  if (!storeId || !shiftTemplateId || !date || !employeeId || hours == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const canEditPast = session!.user.role === "OWNER" || session!.user.role === "ADMIN" || hasPermission(session!.user.role, permissions, "schedule", "EDIT_PAST");
  if (!canEditPast && String(date).slice(0, 10) < todayStr) {
    return NextResponse.json({ error: "Bạn không có quyền thêm giờ làm thêm cho các ngày trong quá khứ." }, { status: 403 });
  }

  // If SCHEDULER, require approval
  if (session!.user.role === "SCHEDULER") {
    const approvalReq = await createScheduleApprovalRequest({
      companyId,
      actionType: "ADD_OVERTIME",
      requestedById: session!.user.id,
      payload: body as Prisma.InputJsonValue,
      conflicts: [],
      message: "Yêu cầu xác nhận thêm giờ làm thêm",
    });

    if ("isDuplicate" in approvalReq && approvalReq.isDuplicate) {
      return NextResponse.json({ error: "Yêu cầu này đã được gửi và đang chờ quản lý duyệt." }, { status: 409 });
    }

    return NextResponse.json(
      { success: true, pendingApproval: true, message: "Đã gửi yêu cầu xác nhận thêm giờ làm thêm" },
      { status: 202 }
    );
  }

  // If ADMIN, create directly
  try {
    const overtime = await prisma.shiftOvertime.create({
      data: {
        companyId,
        storeId,
        shiftTemplateId,
        date: new Date(date),
        employeeId,
        hours: Number(hours),
      },
    });
    return NextResponse.json(overtime, { status: 201 });
  } catch (dbError) {
    console.error("POST /api/schedule/overtime failed", dbError);
    return NextResponse.json({ error: "Failed to add overtime" }, { status: 500 });
  }
}
