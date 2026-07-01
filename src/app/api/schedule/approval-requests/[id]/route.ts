import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import {
  moveAssignment,
  updateAssignment,
  type MoveAssignmentInput,
  type UpdateAssignmentInput,
} from "@/lib/assignment-service";

type ApprovalPayload = {
  input?: UpdateAssignmentInput;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;
  const body = asRecord(await request.json().catch(() => ({})));
  const action = body.action === "REJECT" ? "REJECT" : "APPROVE";

  const approvalRequest = await prisma.scheduleApprovalRequest.findUnique({
    where: { id },
  });

  if (!approvalRequest) {
    return NextResponse.json({ error: "Không tìm thấy yêu cầu duyệt" }, { status: 404 });
  }

  if (approvalRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Yêu cầu này đã được xử lý" }, { status: 409 });
  }

  if (action === "REJECT") {
    await prisma.scheduleApprovalRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Đã từ chối yêu cầu" });
  }

  const result =
    approvalRequest.actionType === "ASSIGN_EMPLOYEE"
      ? await updateAssignment({
          ...((approvalRequest.payload as ApprovalPayload).input ?? {}),
          confirmOverCapacity: true,
        } as UpdateAssignmentInput)
      : await moveAssignment({
          ...(approvalRequest.payload as unknown as MoveAssignmentInput),
          confirmOverCapacity: true,
        });

  if ("error" in result && !("success" in result)) {
    // Tự động xoá yêu cầu nếu duyệt bị lỗi (ví dụ ca đã được điền, người dùng không thể nhận thêm)
    await prisma.scheduleApprovalRequest.delete({
      where: { id },
    });
    return NextResponse.json(result, { status: result.status });
  }

  try {
    // Delete the request instead of updating it to APPROVED, to match the behavior of REJECT
    // and to avoid foreign key constraints if the admin's session is stale.
    await prisma.scheduleApprovalRequest.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: result.message ?? "Đã duyệt và áp dụng yêu cầu",
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Không thể xoá yêu cầu: ${err.message}` }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { id } = await context.params;

  const approvalRequest = await prisma.scheduleApprovalRequest.findUnique({
    where: { id },
  });

  if (!approvalRequest) {
    return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 });
  }

  if (
    session!.user.role !== "ADMIN" &&
    approvalRequest.requestedById !== session!.user.id
  ) {
    return NextResponse.json({ error: "Không có quyền huỷ yêu cầu này" }, { status: 403 });
  }

  await prisma.scheduleApprovalRequest.delete({
    where: { id },
  });

  return NextResponse.json({ success: true, message: "Đã huỷ yêu cầu" });
}
