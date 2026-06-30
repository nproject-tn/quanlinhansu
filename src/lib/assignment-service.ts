import { endOfMonth, format, startOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/utils";
import { validateAssignment } from "@/lib/schedule-engine";

export type UpdateAssignmentInput = {
  assignmentId?: string;
  storeId: string;
  shiftTemplateId: string;
  date: string;
  slotIndex: number;
  employeeId: string | null;
  requiredStaff: number;
  confirmOverCapacity?: boolean;
};

export async function updateAssignment(input: UpdateAssignmentInput) {
  const date = parseDateOnly(input.date);

  if (!input.employeeId) {
    const deleted = input.assignmentId
      ? await prisma.shiftAssignment.deleteMany({
          where: { id: input.assignmentId },
        })
      : await prisma.shiftAssignment.deleteMany({
          where: {
            storeId: input.storeId,
            shiftTemplateId: input.shiftTemplateId,
            date,
            slotIndex: input.slotIndex,
          },
        });

    return {
      success: true,
      deletedCount: deleted.count,
      message: "Đã xóa phân công ca",
      status: 200 as const,
    };
  }

  const [targetShift, employee, allAssignments] = await prisma.$transaction([
    prisma.shiftTemplate.findUnique({
      where: { id: input.shiftTemplateId },
      select: {
        id: true,
        storeId: true,
        name: true,
        startTime: true,
        endTime: true,
        durationHours: true,
        sortOrder: true,
      },
    }),
    prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        name: true,
        maxShiftsPerMonth: true,
        maxHoursPerMonth: true,
        stores: { select: { storeId: true } },
      },
    }),
    prisma.shiftAssignment.findMany({
      where: {
        OR: [
          {
            employeeId: input.employeeId,
            date: { gte: startOfMonth(date), lte: endOfMonth(date) },
          },
          {
            storeId: input.storeId,
            shiftTemplateId: input.shiftTemplateId,
            date,
          },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        storeId: true,
        shiftTemplateId: true,
        date: true,
        slotIndex: true,
        shiftTemplate: {
          select: {
            id: true,
            storeId: true,
            name: true,
            startTime: true,
            endTime: true,
            durationHours: true,
            sortOrder: true,
          },
        },
      },
    }),
  ]);

  if (!targetShift) {
    return { error: "Ca làm không tồn tại", status: 404 as const };
  }

  if (!employee) {
    return { error: "Nhân viên không tồn tại", status: 404 as const };
  }

  const mappedAssignments = allAssignments.map((a) => ({
    id: a.id,
    employeeId: a.employeeId,
    storeId: a.storeId,
    shiftTemplateId: a.shiftTemplateId,
    date: a.date,
    slotIndex: a.slotIndex,
    shiftTemplate: {
      id: a.shiftTemplate.id,
      storeId: a.shiftTemplate.storeId,
      name: a.shiftTemplate.name,
      startTime: a.shiftTemplate.startTime,
      endTime: a.shiftTemplate.endTime,
      durationHours: a.shiftTemplate.durationHours,
      sortOrder: a.shiftTemplate.sortOrder,
    },
  }));

  const conflicts = validateAssignment(
    input.employeeId,
    input.storeId,
    input.shiftTemplateId,
    date,
    input.slotIndex,
    input.requiredStaff,
    mappedAssignments.filter((a) => a.id !== input.assignmentId),
    [targetShift],
    {
      id: employee.id,
      name: employee.name,
      maxShiftsPerMonth: employee.maxShiftsPerMonth,
      maxHoursPerMonth: employee.maxHoursPerMonth,
      storeIds: employee.stores.map((s) => s.storeId),
    }
  );

  if (conflicts.length > 0 && !input.confirmOverCapacity) {
    return {
      error: "Xung đột xếp ca",
      conflicts,
      requiresConfirmation: conflicts.some(
        (c) => c.type === "MAX_HOURS" || c.type === "MAX_SHIFTS"
      ),
      status: 409 as const,
    };
  }

  const assignment = await prisma.shiftAssignment.upsert({
    where: {
      storeId_shiftTemplateId_date_slotIndex: {
        storeId: input.storeId,
        shiftTemplateId: input.shiftTemplateId,
        date,
        slotIndex: input.slotIndex,
      },
    },
    create: {
      storeId: input.storeId,
      shiftTemplateId: input.shiftTemplateId,
      date,
      slotIndex: input.slotIndex,
      employeeId: input.employeeId,
      isManual: true,
    },
    update: {
      employeeId: input.employeeId,
      isManual: true,
    },
    include: {
      employee: true,
      shiftTemplate: true,
      store: true,
    },
  });

  return {
    success: true,
    assignment,
    message: input.employeeId
      ? `Đã xếp ${assignment.employee?.name} vào ca ${assignment.shiftTemplate.name} ngày ${format(date, "dd/MM/yyyy")}`
      : "Đã xóa phân công ca",
    status: 200 as const,
  };
}
