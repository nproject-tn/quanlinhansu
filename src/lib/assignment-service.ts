import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { validateAssignment, getDaysInRange, type UnfilledShift, calculateTotalMonthlyHours, getUtcMonthKey, getDateRange } from "@/lib/schedule-engine";

export type UpdateAssignmentInput = {
  assignmentId?: string;
  storeId: string;
  shiftTemplateId: string;
  date: string;
  slotIndex: number;
  employeeId: string | null;
  requiredStaff: number;
  companyId: string;
  confirmOverCapacity?: boolean;
};

export type MoveAssignmentInput = {
  sourceStoreId: string;
  sourceShiftTemplateId: string;
  sourceDate: string;
  sourceSlotIndex: number;
  targetStoreId: string;
  targetShiftTemplateId: string;
  targetDate: string;
  targetSlotIndex: number;
  targetRequiredStaff: number;
  companyId: string;
  confirmOverCapacity?: boolean;
};

export async function updateAssignment(
  input: UpdateAssignmentInput,
  isScheduler: boolean = false
) {
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

  const [targetShift, employee, allAssignments, store] = await prisma.$transaction([
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
        stores: { select: { storeId: true, maxHoursPerMonth: true } },
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
    prisma.store.findUnique({
      where: { id: input.storeId },
      select: { maxShiftsPerDay: true, maxHoursPerDay: true }
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

  const sourceOriginalMonthAssignments = mappedAssignments.filter(
    (a) => a.employeeId === input.employeeId && getUtcMonthKey(a.date) === getUtcMonthKey(date)
  );

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
      storeMaxHours: employee.stores.reduce((acc, s) => {
        if (s.maxHoursPerMonth !== null && s.maxHoursPerMonth !== undefined) {
          acc[s.storeId] = s.maxHoursPerMonth;
        }
        return acc;
      }, {} as Record<string, number>),
    },
    {
      maxShiftsPerDay: store?.maxShiftsPerDay ?? null,
      maxHoursPerDay: store?.maxHoursPerDay ?? null,
    },
    {
      monthHours: calculateTotalMonthlyHours(sourceOriginalMonthAssignments.map(a => ({ date: a.date, shift: { startTime: a.shiftTemplate.startTime, endTime: a.shiftTemplate.endTime } }))),
      monthShifts: sourceOriginalMonthAssignments.length
    }
  );

  const hasHardConflict = conflicts.some(
    (conflict) => !["MONTHLY_MAX_HOURS", "MONTHLY_MAX_SHIFTS", "STORE_MONTHLY_MAX_HOURS", "DAILY_MAX_HOURS", "DAILY_MAX_SHIFTS"].includes(conflict.type)
  );
  const requiresConfirmation = conflicts.some(
    (conflict) => ["MONTHLY_MAX_HOURS", "MONTHLY_MAX_SHIFTS", "STORE_MONTHLY_MAX_HOURS", "DAILY_MAX_HOURS", "DAILY_MAX_SHIFTS"].includes(conflict.type)
  );

  if (conflicts.length > 0 && (hasHardConflict || !input.confirmOverCapacity)) {
    return {
      error: "Xung đột xếp ca",
      conflicts,
      requiresConfirmation: requiresConfirmation && !hasHardConflict,
      status: 409 as const,
    };
  }

  if (isScheduler && conflicts.length > 0) {
    return {
      success: true,
      pendingApproval: true,
      conflicts,
      status: 202 as const,
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
      companyId: input.companyId,
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

export async function moveAssignment(
  input: MoveAssignmentInput,
  isScheduler: boolean = false
) {
  const targetDateValue = parseDateOnly(input.targetDate);

  const [source, targetAssignment, targetShift, sourceStore, targetStore] = await prisma.$transaction([
    prisma.shiftAssignment.findUnique({
      where: {
        storeId_shiftTemplateId_date_slotIndex: {
          storeId: input.sourceStoreId,
          shiftTemplateId: input.sourceShiftTemplateId,
          date: parseDateOnly(input.sourceDate),
          slotIndex: input.sourceSlotIndex,
        },
      },
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
            stores: { select: { storeId: true, maxHoursPerMonth: true } },
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
            stores: { select: { storeId: true, maxHoursPerMonth: true } },
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
    prisma.store.findUnique({
      where: { id: input.sourceStoreId },
      select: { maxShiftsPerDay: true, maxHoursPerDay: true },
    }),
    prisma.store.findUnique({
      where: { id: input.targetStoreId },
      select: { maxShiftsPerDay: true, maxHoursPerDay: true },
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

  const sourceOriginalAssignments = relevantAssignments.filter(
    (a) => a.employeeId === source.employeeId && getUtcMonthKey(a.date) === getUtcMonthKey(targetDateValue)
  );
  const targetOriginalAssignments = targetAssignment?.employeeId ? relevantAssignments.filter(
    (a) => a.employeeId === targetAssignment.employeeId && getUtcMonthKey(a.date) === getUtcMonthKey(source.date)
  ) : [];

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
      storeMaxHours: source.employee.stores.reduce((acc, s) => {
        if (s.maxHoursPerMonth !== null && s.maxHoursPerMonth !== undefined) {
          acc[s.storeId] = s.maxHoursPerMonth;
        }
        return acc;
      }, {} as Record<string, number>),
    },
    {
      maxShiftsPerDay: targetStore?.maxShiftsPerDay ?? null,
      maxHoursPerDay: targetStore?.maxHoursPerDay ?? null,
    },
    {
      monthHours: calculateTotalMonthlyHours(sourceOriginalAssignments.map(a => ({ date: a.date, shift: { startTime: a.shiftTemplate.startTime, endTime: a.shiftTemplate.endTime } }))),
      monthShifts: sourceOriginalAssignments.length
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
            storeMaxHours: targetAssignment.employee.stores.reduce((acc, s) => {
              if (s.maxHoursPerMonth !== null && s.maxHoursPerMonth !== undefined) {
                acc[s.storeId] = s.maxHoursPerMonth;
              }
              return acc;
            }, {} as Record<string, number>),
          },
          {
            maxShiftsPerDay: sourceStore?.maxShiftsPerDay ?? null,
            maxHoursPerDay: sourceStore?.maxHoursPerDay ?? null,
          },
          {
            monthHours: calculateTotalMonthlyHours(targetOriginalAssignments.map(a => ({ date: a.date, shift: { startTime: a.shiftTemplate.startTime, endTime: a.shiftTemplate.endTime } }))),
            monthShifts: targetOriginalAssignments.length
          }
        )
      : [];

  const conflicts = [...sourceConflicts, ...targetConflicts].filter(
    (c) => c.type !== "MONTHLY_MAX_HOURS" && c.type !== "MONTHLY_MAX_SHIFTS" && c.type !== "STORE_MONTHLY_MAX_HOURS"
  );
  const hasHardConflict = conflicts.some(
    (conflict) => conflict.type !== "DAILY_MAX_HOURS" && conflict.type !== "DAILY_MAX_SHIFTS"
  );
  const requiresConfirmation = conflicts.some(
    (conflict) => conflict.type === "DAILY_MAX_HOURS" || conflict.type === "DAILY_MAX_SHIFTS"
  );

  if (conflicts.length > 0 && (hasHardConflict || !input.confirmOverCapacity)) {
    return {
      error: "Xung đột xếp ca",
      conflicts,
      requiresConfirmation: requiresConfirmation && !hasHardConflict,
      status: 409 as const,
    };
  }

  if (isScheduler && conflicts.length > 0) {
    return {
      success: true,
      pendingApproval: true,
      conflicts,
      status: 202 as const,
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
        companyId: input.companyId,
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
