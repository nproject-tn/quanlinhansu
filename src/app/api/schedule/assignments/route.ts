import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { moveAssignment, updateAssignment, type MoveAssignmentInput } from "@/lib/assignment-service";
import { createScheduleApprovalRequest } from "@/lib/schedule-approval";
import { assignmentUpdateSchema } from "@/lib/validations";
import type { Prisma } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";

export async function PUT(request: Request) {
  const { session, permissions, error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  const body = await request.json();
  const parsed = assignmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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

  return NextResponse.json({
    success: result.success,
    message: result.message,
  });
}
