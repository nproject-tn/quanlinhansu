import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

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
      where: { id: assignmentId },
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
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  try {
    const body = await request.json();
    const { id, note, evidenceUrl, createdAt } = body;

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID lỗi" }, { status: 400 });
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
  const { session, error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu ID lỗi" }, { status: 400 });
    }

    if (session!.user.role === "SCHEDULER") {
      const { createScheduleApprovalRequest } = await import("@/lib/schedule-approval");
      const fault = await prisma.shiftFault.findUnique({
        where: { id },
        include: { employee: true, assignment: { include: { shiftTemplate: true } } }
      });
      
      if (!fault) {
        return NextResponse.json({ error: "Lỗi không tồn tại" }, { status: 404 });
      }

      await createScheduleApprovalRequest({
        actionType: "DELETE_FAULT",
        requestedById: session!.user.id,
        payload: { 
          faultId: id,
          input: {
            employeeId: fault.employeeId,
            date: fault.assignment.date,
            storeId: fault.assignment.storeId,
            shiftTemplateId: fault.assignment.shiftTemplateId,
            faultNote: fault.note,
            faultTime: fault.createdAt
          }
        },
        conflicts: [],
        message: `Yêu cầu xoá lỗi của nhân viên ${fault.employee.name} trong ca ${fault.assignment.shiftTemplate.name} (${fault.note || "Không có ghi chú"})`,
      });

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
