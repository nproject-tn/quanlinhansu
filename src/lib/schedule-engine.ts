import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";
import { formatDateOnly } from "@/lib/utils";

export type ShiftTime = {
  id: string;
  storeId: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  sortOrder: number;
};

export type AssignmentSlot = {
  storeId: string;
  shiftTemplateId: string;
  date: Date;
  slotIndex: number;
  requiredStaff: number;
  employeeId: string | null;
  assignmentId?: string;
};

export type ScheduleConflict = {
  type: "OVERLAP" | "MAX_SHIFTS" | "MAX_HOURS" | "OVER_CAPACITY" | "SINGLE_STAFF";
  message: string;
  employeeId?: string;
  date?: string;
};

export type UnfilledShift = {
  storeId: string;
  storeName: string;
  shiftName: string;
  date: string;
  slotIndex: number;
  requiredStaff: number;
};

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const buildVariants = (start: string, end: string) => {
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    const normalizedEnd =
      endMinutes <= startMinutes ? endMinutes + 24 * 60 : endMinutes;

    return [
      [startMinutes, normalizedEnd],
      [startMinutes + 24 * 60, normalizedEnd + 24 * 60],
    ] as const;
  };

  const aVariants = buildVariants(startA, endA);
  const bVariants = buildVariants(startB, endB);

  return aVariants.some(([aStart, aEnd]) =>
    bVariants.some(([bStart, bEnd]) => aStart < bEnd && bStart < aEnd)
  );
}

export function getDateRange(
  mode: "week" | "month",
  referenceDate: Date
): { start: Date; end: Date } {
  if (mode === "week") {
    return {
      start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
      end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
    };
  }
  return {
    start: startOfMonth(referenceDate),
    end: endOfMonth(referenceDate),
  };
}

export function getRequiredStaff(
  date: Date,
  shiftTemplateId: string,
  storeId: string,
  rules: { dayOfWeek: number; shiftTemplateId: string; storeId: string; requiredStaff: number }[],
  overrides: { date: Date; shiftTemplateId: string; storeId: string; requiredStaff: number }[]
): number {
  const dateStr = formatDateOnly(date);
  const override = overrides.find(
    (o) =>
      o.storeId === storeId &&
      o.shiftTemplateId === shiftTemplateId &&
      formatDateOnly(o.date) === dateStr
  );
  if (override) return override.requiredStaff;

  const dayOfWeek = getDay(date);
  const rule = rules.find(
    (r) =>
      r.storeId === storeId &&
      r.shiftTemplateId === shiftTemplateId &&
      r.dayOfWeek === dayOfWeek
  );
  return rule?.requiredStaff ?? 1;
}

export function buildAssignmentSlots(
  dates: Date[],
  stores: { id: string; name: string }[],
  shifts: ShiftTime[],
  rules: { dayOfWeek: number; shiftTemplateId: string; storeId: string; requiredStaff: number }[],
  overrides: { date: Date; shiftTemplateId: string; storeId: string; requiredStaff: number }[],
  existing: {
    id: string;
    storeId: string;
    shiftTemplateId: string;
    date: Date;
    slotIndex: number;
    employeeId: string | null;
  }[]
): AssignmentSlot[] {
  const slots: AssignmentSlot[] = [];
  const shiftsByStore = new Map<string, ShiftTime[]>();
  const rulesByKey = new Map<string, number>();
  const overridesByKey = new Map<string, number>();
  const existingByKey = new Map<string, (typeof existing)[number]>();

  for (const shift of shifts) {
    const storeShifts = shiftsByStore.get(shift.storeId) ?? [];
    storeShifts.push(shift);
    shiftsByStore.set(shift.storeId, storeShifts);
  }

  for (const storeShifts of shiftsByStore.values()) {
    storeShifts.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  for (const rule of rules) {
    rulesByKey.set(
      `${rule.storeId}|${rule.shiftTemplateId}|${rule.dayOfWeek}`,
      rule.requiredStaff
    );
  }

  for (const override of overrides) {
    overridesByKey.set(
      `${override.storeId}|${override.shiftTemplateId}|${formatDateOnly(override.date)}`,
      override.requiredStaff
    );
  }

  for (const assignment of existing) {
    existingByKey.set(
      `${assignment.storeId}|${assignment.shiftTemplateId}|${formatDateOnly(assignment.date)}|${assignment.slotIndex}`,
      assignment
    );
  }

  for (const date of dates) {
    const dateStr = formatDateOnly(date);
    const dayOfWeek = getDay(date);
    for (const store of stores) {
      const storeShifts = shiftsByStore.get(store.id) ?? [];

      for (const shift of storeShifts) {
        const required =
          overridesByKey.get(`${store.id}|${shift.id}|${dateStr}`) ??
          rulesByKey.get(`${store.id}|${shift.id}|${dayOfWeek}`) ??
          1;

        for (let slotIndex = 0; slotIndex < required; slotIndex++) {
          const found = existingByKey.get(
            `${store.id}|${shift.id}|${dateStr}|${slotIndex}`
          );
          slots.push({
            storeId: store.id,
            shiftTemplateId: shift.id,
            date,
            slotIndex,
            requiredStaff: required,
            employeeId: found?.employeeId ?? null,
            assignmentId: found?.id,
          });
        }
      }
    }
  }

  return slots;
}

type EmployeeForSchedule = {
  id: string;
  name: string;
  maxShiftsPerMonth: number;
  maxHoursPerMonth: number;
  storeIds: string[];
};

type AssignmentRecord = {
  employeeId: string | null;
  storeId: string;
  shiftTemplateId: string;
  date: Date;
  slotIndex: number;
  shift: ShiftTime;
};

export function autoAssignShifts(
  slots: AssignmentSlot[],
  employees: EmployeeForSchedule[],
  shifts: ShiftTime[],
  preserveManual = true
): AssignmentSlot[] {
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const result = slots.map((s) => ({ ...s }));

  const manualKeys = new Set(
    result.filter((s) => s.employeeId && preserveManual).map(slotKey)
  );

  const assigned: AssignmentRecord[] = result
    .filter((s) => s.employeeId)
    .map((s) => ({
      employeeId: s.employeeId,
      storeId: s.storeId,
      shiftTemplateId: s.shiftTemplateId,
      date: s.date,
      slotIndex: s.slotIndex,
      shift: shiftMap.get(s.shiftTemplateId)!,
    }));

  const emptySlots = result.filter(
    (s) => !s.employeeId && !manualKeys.has(slotKey(s))
  );

  for (const slot of emptySlots) {
    const shift = shiftMap.get(slot.shiftTemplateId);
    if (!shift) continue;

    const candidates = employees
      .filter((e) => e.storeIds.includes(slot.storeId))
      .map((employee) => ({
        employee,
        score: scoreCandidate(employee, slot, shift, assigned, shifts),
      }))
      .filter((c) => c.score > -1000)
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      slot.employeeId = candidates[0].employee.id;
      assigned.push({
        employeeId: candidates[0].employee.id,
        storeId: slot.storeId,
        shiftTemplateId: slot.shiftTemplateId,
        date: slot.date,
        slotIndex: slot.slotIndex,
        shift,
      });
    }
  }

  return result;
}

function slotKey(s: AssignmentSlot): string {
  return `${s.storeId}-${s.shiftTemplateId}-${formatDateOnly(s.date)}-${s.slotIndex}`;
}

function scoreCandidate(
  employee: EmployeeForSchedule,
  slot: AssignmentSlot,
  shift: ShiftTime,
  assigned: AssignmentRecord[],
  allShifts: ShiftTime[]
): number {
  const dateStr = formatDateOnly(slot.date);
  const sameDayShifts = assigned.filter(
    (a) => a.employeeId === employee.id && formatDateOnly(a.date) === dateStr
  );

  if (sameDayShifts.length >= 3) {
    return -1000;
  }

  const conflicts = validateAssignment(
    employee.id,
    slot.storeId,
    slot.shiftTemplateId,
    slot.date,
    slot.slotIndex,
    slot.requiredStaff,
    assigned.map((a) => ({
      id: "temp",
      employeeId: a.employeeId,
      storeId: a.storeId,
      shiftTemplateId: a.shiftTemplateId,
      date: a.date,
      slotIndex: a.slotIndex,
      shiftTemplate: a.shift,
    })),
    allShifts,
    employee
  );

  if (conflicts.length > 0) return -1000;

  let score = 0;
  const yesterday = formatDateOnly(addDays(slot.date, -1));

  const monthHours = assigned
    .filter(
      (a) =>
        a.employeeId === employee.id &&
        format(a.date, "yyyy-MM") === format(slot.date, "yyyy-MM")
    )
    .reduce((sum, a) => sum + a.shift.durationHours, 0);

  const weekShifts = assigned.filter(
    (a) =>
      a.employeeId === employee.id &&
      formatDateOnly(a.date) >=
        formatDateOnly(startOfWeek(slot.date, { weekStartsOn: 1 })) &&
      formatDateOnly(a.date) <=
        formatDateOnly(endOfWeek(slot.date, { weekStartsOn: 1 }))
  ).length;

  const monthShifts = assigned.filter(
    (a) =>
      a.employeeId === employee.id &&
      format(a.date, "yyyy-MM") === format(slot.date, "yyyy-MM")
  ).length;

  score -= monthHours * 2;
  score -= monthShifts * 10;
  score -= weekShifts * 5;

  const yesterdayShift = assigned.find(
    (a) =>
      a.employeeId === employee.id && formatDateOnly(a.date) === yesterday
  );

  if (yesterdayShift) {
    if (yesterdayShift.shiftTemplateId === slot.shiftTemplateId) {
      score -= 80;
    } else {
      score += 60;
    }
    if (yesterdayShift.storeId === slot.storeId) {
      score -= 20;
    } else {
      score += 30;
    }
  } else {
    score += 20;
  }

  score -= sameDayShifts.length * 40;

  score += Math.random() * 5;

  return score;
}

export function validateAssignment(
  employeeId: string,
  storeId: string,
  shiftTemplateId: string,
  date: Date,
  slotIndex: number,
  requiredStaff: number,
  allAssignments: {
    id: string;
    employeeId: string | null;
    storeId: string;
    shiftTemplateId: string;
    date: Date;
    slotIndex: number;
    shiftTemplate: ShiftTime;
  }[],
  shifts: ShiftTime[],
  employee?: EmployeeForSchedule
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const dateStr = formatDateOnly(date);
  const targetShift = shifts.find((s) => s.id === shiftTemplateId);
  if (!targetShift) return conflicts;

  const sameSlotOthers = allAssignments.filter(
    (a) =>
      a.storeId === storeId &&
      a.shiftTemplateId === shiftTemplateId &&
      formatDateOnly(a.date) === dateStr &&
      a.slotIndex !== slotIndex &&
      a.employeeId === employeeId
  );
  if (sameSlotOthers.length > 0) {
    conflicts.push({
      type: "OVERLAP",
      message: "Nhân viên đã được xếp vào ca này",
      employeeId,
      date: dateStr,
    });
  }

  const employeeAssignments = allAssignments.filter(
    (a) => a.employeeId === employeeId && formatDateOnly(a.date) === dateStr
  );

  if (employeeAssignments.length >= 3) {
    conflicts.push({
      type: "MAX_SHIFTS",
      message: "Mỗi nhân viên chỉ được làm tối đa 3 ca trong một ngày",
      employeeId,
      date: dateStr,
    });
  }

  for (const existing of employeeAssignments) {
    if (
      existing.storeId === storeId &&
      existing.shiftTemplateId === shiftTemplateId &&
      existing.slotIndex === slotIndex
    ) {
      continue;
    }
    if (
      timesOverlap(
        targetShift.startTime,
        targetShift.endTime,
        existing.shiftTemplate.startTime,
        existing.shiftTemplate.endTime
      )
    ) {
      conflicts.push({
        type: "OVERLAP",
        message: `Trùng giờ với ca ${existing.shiftTemplate.name} tại cửa hàng khác hoặc cùng ngày`,
        employeeId,
        date: dateStr,
      });
    }
  }

  if (requiredStaff <= 1 && slotIndex === 0) {
    const filled = allAssignments.filter(
      (a) =>
        a.storeId === storeId &&
        a.shiftTemplateId === shiftTemplateId &&
        formatDateOnly(a.date) === dateStr &&
        a.employeeId
    );
    if (filled.length >= 1 && !filled.some((f) => f.employeeId === employeeId)) {
      conflicts.push({
        type: "SINGLE_STAFF",
        message: "Ca này chỉ cần 1 nhân viên, không thể thêm người khác",
        date: dateStr,
      });
    }
  }

  if (employee) {
    if (!employee.storeIds.includes(storeId)) {
      conflicts.push({
        type: "OVER_CAPACITY",
        message: "Nhân viên không được phân công cho cửa hàng này",
        employeeId,
        date: dateStr,
      });
    }

    const monthShifts = allAssignments.filter(
      (a) =>
        a.employeeId === employeeId &&
        format(a.date, "yyyy-MM") === format(date, "yyyy-MM")
    ).length;

    if (monthShifts >= employee.maxShiftsPerMonth) {
      conflicts.push({
        type: "MAX_SHIFTS",
        message: `Vượt số ca tối đa/tháng (${employee.maxShiftsPerMonth} ca)`,
        employeeId,
        date: dateStr,
      });
    }

    const monthHours = allAssignments
      .filter(
        (a) =>
          a.employeeId === employeeId &&
          format(a.date, "yyyy-MM") === format(date, "yyyy-MM")
      )
      .reduce((sum, a) => sum + a.shiftTemplate.durationHours, 0);

    if (monthHours + targetShift.durationHours > employee.maxHoursPerMonth) {
      conflicts.push({
        type: "MAX_HOURS",
        message: `Vượt số giờ tối đa/tháng (${employee.maxHoursPerMonth}h)`,
        employeeId,
        date: dateStr,
      });
    }
  }

  return conflicts;
}

export function findUnfilledShifts(
  slots: AssignmentSlot[],
  stores: { id: string; name: string }[],
  shifts: ShiftTime[]
): UnfilledShift[] {
  const unfilled: UnfilledShift[] = [];
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const shiftMap = new Map(shifts.map((s) => [s.id, s.name]));

  for (const slot of slots) {
    if (!slot.employeeId) {
      unfilled.push({
        storeId: slot.storeId,
        storeName: storeMap.get(slot.storeId) ?? "",
        shiftName: shiftMap.get(slot.shiftTemplateId) ?? "",
        date: formatDateOnly(slot.date),
        slotIndex: slot.slotIndex,
        requiredStaff: slot.requiredStaff,
      });
    }
  }

  return unfilled;
}

export function formatDateVi(date: Date): string {
  return format(date, "EEEE, dd/MM/yyyy", { locale: vi });
}

export function getDaysInRange(start: Date, end: Date): Date[] {
  return eachDayOfInterval({ start, end });
}
