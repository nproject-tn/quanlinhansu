import { NextResponse } from "next/server";
import { endOfMonth, getDay, startOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { updateAssignment } from "@/lib/assignment-service";
import { validateAssignment } from "@/lib/schedule-engine";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { assignmentUpdateSchema } from "@/lib/validations";

export async function PUT(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const body = await request.json();
  const parsed = assignmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await updateAssignment(parsed.data);

  if ("error" in result && !("success" in result)) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const body = await request.json();
  const {
    sourceAssignmentId,
    targetStoreId,
    targetShiftTemplateId,
    targetDate,
    targetSlotIndex,
    targetRequiredStaff,
    confirmOverCapacity,
  } = body;
  const targetDateValue = parseDateOnly(targetDate);

  const [source, targetAssignment, targetShift] = await prisma.$transaction([
    prisma.shiftAssignment.findUnique({
      where: { id: sourceAssignmentId },
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
          storeId: targetStoreId,
          shiftTemplateId: targetShiftTemplateId,
          date: targetDateValue,
          slotIndex: targetSlotIndex,
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
      where: { id: targetShiftTemplateId },
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
    return NextResponse.json({ error: "Ca nguồn không có nhân viên" }, { status: 400 });
  }
  if (!source.employee || !targetShift) {
    return NextResponse.json({ error: "Không tìm thấy dữ liệu ca làm" }, { status: 404 });
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
          dayOfWeek: getDay(source.date),
        },
      },
      select: { requiredStaff: true },
    }),
  ]);
  if (
    source.storeId === targetStoreId &&
    source.shiftTemplateId === targetShiftTemplateId &&
    source.slotIndex === targetSlotIndex &&
    formatDateOnly(source.date) === targetDate
  ) {
    return NextResponse.json({ success: true, message: "Ca không thay đổi" });
  }

  const employeeIds = [source.employeeId, targetAssignment?.employeeId]
    .filter((value): value is string => Boolean(value));
  const targetHasEmployee = Boolean(targetAssignment?.employeeId);
  const rangeStart =
    source.date < targetDateValue ? startOfMonth(source.date) : startOfMonth(targetDateValue);
  const rangeEnd =
    source.date > targetDateValue ? endOfMonth(source.date) : endOfMonth(targetDateValue);

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
    targetStoreId,
    targetShiftTemplateId,
    targetDateValue,
    targetSlotIndex,
    targetRequiredStaff,
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

  if (conflicts.length > 0 && (hasHardConflict || !confirmOverCapacity)) {
    return NextResponse.json(
      {
        error: "Xung đột xếp ca",
        conflicts,
        requiresConfirmation: requiresConfirmation && !hasHardConflict,
      },
      { status: 409 }
    );
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
          storeId: targetStoreId,
          shiftTemplateId: targetShiftTemplateId,
          date: targetDateValue,
          slotIndex: targetSlotIndex,
        },
      },
      create: {
        storeId: targetStoreId,
        shiftTemplateId: targetShiftTemplateId,
        date: targetDateValue,
        slotIndex: targetSlotIndex,
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

  return NextResponse.json({
    success: true,
    message: targetHasEmployee ? "Đã đổi ca thành công" : "Đã chuyển ca thành công",
  });
}
