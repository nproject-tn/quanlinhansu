import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { getDateRange, validateAssignment } from "@/lib/schedule-engine";

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

export type MoveAssignmentInput = {
  sourceAssignmentId: string;
  targetStoreId: string;
  targetShiftTemplateId: string;
  targetDate: string;
  targetSlotIndex: number;
  targetRequiredStaff: number;
  confirmOverCapacity?: boolean;
};

export async function updateAssignment(input: UpdateAssignmentInput) {
  const date = parseDateOnly(input.date);
  const { start: monthStart, end: monthEnd } = getDateRange("month", date);

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
            date: { gte: monthStart, lte: monthEnd },
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

  const hasHardConflict = conflicts.some(
    (conflict) => conflict.type !== "MAX_HOURS" && conflict.type !== "MAX_SHIFTS"
  );
  const requiresConfirmation = conflicts.some(
    (conflict) => conflict.type === "MAX_HOURS" || conflict.type === "MAX_SHIFTS"
  );

  if (conflicts.length > 0 && (hasHardConflict || !input.confirmOverCapacity)) {
    return {
      error: "Xung đột xếp ca",
      conflicts,
      requiresConfirmation: requiresConfirmation && !hasHardConflict,
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

export async function moveAssignment(input: MoveAssignmentInput) {
  const targetDateValue = parseDateOnly(input.targetDate);

  const [source, targetAssignment, targetShift] = await prisma.$transaction([
    prisma.shiftAssignment.findUnique({
      where: { id: input.sourceAssignmentId },
      select: {
        id: true,
        employeeId: true,
        storeId: true,
        shiftTemplateId: true,
        date: true,
        slotIndex: true,
        employee: {
          select: {
            id: true,
            name: true,
            maxShiftsPerMonth: true,
            maxHoursPerMonth: true,
            stores: { select: { storeId: true } },
          },
        },
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
    prisma.shiftAssignment.findUnique({
      where: {
        storeId_shiftTemplateId_date_slotIndex: {
          storeId: input.targetStoreId,
          shiftTemplateId: input.targetShiftTemplateId,
          date: targetDateValue,
          slotIndex: input.targetSlotIndex,
        },
      },
      select: {
        id: true,
        employeeId: true,
        employee: {
          select: {
            id: true,
            name: true,
            maxShiftsPerMonth: true,
            maxHoursPerMonth: true,
            stores: { select: { storeId: true } },
          },
        },
      },
    }),
    prisma.shiftTemplate.findUnique({
      where: { id: input.targetShiftTemplateId },
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
  ]);

  if (!source?.employeeId) {
    return { error: "Ca nguồn không có nhân viên", status: 400 as const };
  }

  if (!source.employee || !targetShift) {
    return { error: "Không tìm thấy dữ liệu ca làm", status: 404 as const };
  }

  const [sourceOverride, sourceRule] = await prisma.$transaction([
    prisma.staffingOverride.findUnique({
      where: {
        storeId_shiftTemplateId_date: {
          storeId: source.storeId,
          shiftTemplateId: source.shiftTemplateId,
          date: source.date,
        },
      },
      select: { requiredStaff: true },
    }),
    prisma.staffingRule.findUnique({
      where: {
        storeId_shiftTemplateId_dayOfWeek: {
          storeId: source.storeId,
          shiftTemplateId: source.shiftTemplateId,
          dayOfWeek: source.date.getUTCDay(),
        },
      },
      select: { requiredStaff: true },
    }),
  ]);

  if (
    source.storeId === input.targetStoreId &&
    source.shiftTemplateId === input.targetShiftTemplateId &&
    source.slotIndex === input.targetSlotIndex &&
    formatDateOnly(source.date) === input.targetDate
  ) {
    return { success: true, message: "Ca không thay đổi", status: 200 as const };
  }

  const employeeIds = [source.employeeId, targetAssignment?.employeeId]
    .filter((value): value is string => Boolean(value));
  const targetHasEmployee = Boolean(targetAssignment?.employeeId);
  const sourceMonth = getDateRange("month", source.date);
  const targetMonth = getDateRange("month", targetDateValue);
  const rangeStart = sourceMonth.start < targetMonth.start ? sourceMonth.start : targetMonth.start;
  const rangeEnd = sourceMonth.end > targetMonth.end ? sourceMonth.end : targetMonth.end;

  const relevantAssignments = await prisma.shiftAssignment.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: { gte: rangeStart, lte: rangeEnd },
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
  });

  const excludedIds = new Set(
    [source.id, targetAssignment?.id].filter((value): value is string => Boolean(value))
  );
  const baseAssignments = relevantAssignments.filter((assignment) => !excludedIds.has(assignment.id));

  const sourceConflicts = validateAssignment(
    source.employeeId,
    input.targetStoreId,
    input.targetShiftTemplateId,
    targetDateValue,
    input.targetSlotIndex,
    input.targetRequiredStaff,
    baseAssignments,
    [targetShift],
    {
      id: source.employee.id,
      name: source.employee.name,
      maxShiftsPerMonth: source.employee.maxShiftsPerMonth,
      maxHoursPerMonth: source.employee.maxHoursPerMonth,
      storeIds: source.employee.stores.map((store) => store.storeId),
    }
  );

  const sourceRequiredStaff =
    sourceOverride?.requiredStaff ?? sourceRule?.requiredStaff ?? 1;

  const targetConflicts =
    targetAssignment?.employeeId && targetAssignment.employee
      ? validateAssignment(
          targetAssignment.employeeId,
          source.storeId,
          source.shiftTemplateId,
          source.date,
          source.slotIndex,
          sourceRequiredStaff,
          baseAssignments,
          [source.shiftTemplate],
          {
            id: targetAssignment.employee.id,
            name: targetAssignment.employee.name,
            maxShiftsPerMonth: targetAssignment.employee.maxShiftsPerMonth,
            maxHoursPerMonth: targetAssignment.employee.maxHoursPerMonth,
            storeIds: targetAssignment.employee.stores.map((store) => store.storeId),
          }
        )
      : [];

  const conflicts = [...sourceConflicts, ...targetConflicts];
  const hasHardConflict = conflicts.some(
    (conflict) => conflict.type !== "MAX_HOURS" && conflict.type !== "MAX_SHIFTS"
  );
  const requiresConfirmation = conflicts.some(
    (conflict) => conflict.type === "MAX_HOURS" || conflict.type === "MAX_SHIFTS"
  );

  if (conflicts.length > 0 && (hasHardConflict || !input.confirmOverCapacity)) {
    return {
      error: "Xung đột xếp ca",
      conflicts,
      requiresConfirmation: requiresConfirmation && !hasHardConflict,
      status: 409 as const,
    };
  }

  await prisma.$transaction(async (tx) => {
    if (targetHasEmployee && targetAssignment?.id) {
      await tx.shiftAssignment.update({
        where: { id: targetAssignment.id },
        data: {
          employeeId: source.employeeId,
          isManual: true,
        },
      });
      await tx.shiftAssignment.update({
        where: { id: source.id },
        data: {
          employeeId: targetAssignment.employeeId,
          isManual: true,
        },
      });
      return;
    }

    await tx.shiftAssignment.upsert({
      where: {
        storeId_shiftTemplateId_date_slotIndex: {
          storeId: input.targetStoreId,
          shiftTemplateId: input.targetShiftTemplateId,
          date: targetDateValue,
          slotIndex: input.targetSlotIndex,
        },
      },
      create: {
        storeId: input.targetStoreId,
        shiftTemplateId: input.targetShiftTemplateId,
        date: targetDateValue,
        slotIndex: input.targetSlotIndex,
        employeeId: source.employeeId,
        isManual: true,
      },
      update: {
        employeeId: source.employeeId,
        isManual: true,
      },
    });

    await tx.shiftAssignment.delete({
      where: { id: source.id },
    });
  });

  return {
    success: true,
    message: targetHasEmployee ? "Đã đổi ca thành công" : "Đã chuyển ca thành công",
    status: 200 as const,
  };
}
