import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { moveAssignment, updateAssignment, type MoveAssignmentInput } from "@/lib/assignment-service";
import { createScheduleApprovalRequest } from "@/lib/schedule-approval";
import { assignmentUpdateSchema } from "@/lib/validations";
import type { Prisma } from "@/generated/prisma/client";

export async function PUT(request: Request) {
  const { session, error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const body = await request.json();
  const parsed = assignmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const isScheduler = session!.user.role === "SCHEDULER";
  const result = await updateAssignment({
    ...parsed.data,
    confirmOverCapacity: isScheduler ? false : parsed.data.confirmOverCapacity,
  });

  if (
    isScheduler &&
    "requiresConfirmation" in result &&
    result.requiresConfirmation &&
    "conflicts" in result
  ) {
    await createScheduleApprovalRequest({
      actionType: "ASSIGN_EMPLOYEE",
      requestedById: session!.user.id,
      payload: { input: parsed.data } as Prisma.InputJsonValue,
      conflicts: result.conflicts,
      message: "Yêu cầu xác nhận xếp ca vượt giới hạn",
    });

    return NextResponse.json(
      {
        success: true,
        pendingApproval: true,
        message: "Đã gửi yêu cầu quản lí xác nhận",
        conflicts: result.conflicts,
      },
      { status: 202 }
    );
  }

  if ("error" in result && !("success" in result)) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const body = await request.json();
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
    confirmOverCapacity:
      session!.user.role === "SCHEDULER" ? false : Boolean(body.confirmOverCapacity),
  };

  const result = await moveAssignment(input);

  if (
    session!.user.role === "SCHEDULER" &&
    "requiresConfirmation" in result &&
    result.requiresConfirmation &&
    "conflicts" in result
  ) {
    await createScheduleApprovalRequest({
      actionType: "MOVE_ASSIGNMENT",
      requestedById: session!.user.id,
      payload: input as unknown as Prisma.InputJsonValue,
      conflicts: result.conflicts,
      message: "Yêu cầu xác nhận đổi ca vượt giới hạn",
    });

    return NextResponse.json(
      {
        success: true,
        pendingApproval: true,
        message: "Đã gửi yêu cầu quản lí xác nhận",
        conflicts: result.conflicts,
      },
      { status: 202 }
    );
  }

  if ("error" in result && !("success" in result)) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json({
    success: result.success,
    message: result.message,
  });
}
