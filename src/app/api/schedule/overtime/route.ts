import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createScheduleApprovalRequest } from "@/lib/schedule-approval";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request) {
  const { session, error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const body = await request.json();
  const { storeId, shiftTemplateId, date, employeeId, hours } = body;

  if (!storeId || !shiftTemplateId || !date || !employeeId || hours == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // If SCHEDULER, require approval
  if (session!.user.role === "SCHEDULER") {
    await createScheduleApprovalRequest({
      actionType: "ADD_OVERTIME",
      requestedById: session!.user.id,
      payload: body as Prisma.InputJsonValue,
      conflicts: [],
      message: "Yêu cầu xác nhận thêm giờ làm thêm",
    });

    return NextResponse.json(
      { success: true, pendingApproval: true, message: "Đã gửi yêu cầu xác nhận thêm giờ làm thêm" },
      { status: 202 }
    );
  }

  // If ADMIN, create directly
  try {
    const overtime = await prisma.shiftOvertime.create({
      data: {
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
