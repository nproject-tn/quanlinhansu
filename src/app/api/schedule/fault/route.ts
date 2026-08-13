import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { assignmentId, employeeId, note, evidenceUrl, createdAt } = body;

    if (!assignmentId || !employeeId) {
      return NextResponse.json(
        { error: "assignmentId và employeeId là bắt buộc" },
        { status: 400 }
      );
    }

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId, companyId },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Không tìm thấy ca làm" }, { status: 404 });
    }

    const fault = await prisma.shiftFault.create({
      data: {
        assignmentId,
        employeeId,
        note: note || null,
        evidenceUrl: evidenceUrl || null,
        ...(createdAt && { createdAt: new Date(createdAt) }),
      },
    });

    return NextResponse.json({ success: true, fault });
  } catch (error: any) {
    console.error("POST /api/schedule/fault error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { id, note, evidenceUrl, createdAt } = body;

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID lỗi" }, { status: 400 });
    }

    const existingFault = await prisma.shiftFault.findUnique({
      where: { id },
      include: { assignment: true },
    });

    if (!existingFault || existingFault.assignment.companyId !== companyId) {
      return NextResponse.json({ error: "Lỗi không tồn tại hoặc không có quyền" }, { status: 404 });
    }

    const fault = await prisma.shiftFault.update({
      where: { id },
      data: {
        note: note !== undefined ? note : undefined,
        evidenceUrl: evidenceUrl !== undefined ? evidenceUrl : undefined,
        ...(createdAt && { createdAt: new Date(createdAt) }),
      },
    });

    return NextResponse.json({ success: true, fault });
  } catch (error: any) {
    console.error("PATCH /api/schedule/fault error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { session, error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID lỗi" }, { status: 400 });
    }

    const existingFault = await prisma.shiftFault.findUnique({
      where: { id },
      include: { employee: true, assignment: { include: { shiftTemplate: true } } }
    });
    
    if (!existingFault || existingFault.assignment.companyId !== companyId) {
      return NextResponse.json({ error: "Lỗi không tồn tại hoặc không có quyền" }, { status: 404 });
    }

    if (session!.user.role === "SCHEDULER") {
      const { createScheduleApprovalRequest } = await import("@/lib/schedule-approval");

      const approvalReq = await createScheduleApprovalRequest({
        companyId,
        actionType: "DELETE_FAULT",
        requestedById: session!.user.id,
        payload: { 
          faultId: id,
          input: {
            employeeId: existingFault.employeeId,
            date: existingFault.assignment.date,
            storeId: existingFault.assignment.storeId,
            shiftTemplateId: existingFault.assignment.shiftTemplateId,
            faultNote: existingFault.note,
            faultTime: existingFault.createdAt
          }
        },
        conflicts: [],
        message: `Yêu cầu xoá lỗi của nhân viên ${existingFault.employee.name} trong ca ${existingFault.assignment.shiftTemplate.name} (${existingFault.note || "Không có ghi chú"})`,
      });

      if ("isDuplicate" in approvalReq && approvalReq.isDuplicate) {
        return NextResponse.json({ error: "Yêu cầu này đã được gửi và đang chờ quản lý duyệt." }, { status: 409 });
      }

      return NextResponse.json({ success: true, pendingApproval: true });
    }

    await prisma.shiftFault.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, pendingApproval: false });
  } catch (error: any) {
    console.error("DELETE /api/schedule/fault error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
