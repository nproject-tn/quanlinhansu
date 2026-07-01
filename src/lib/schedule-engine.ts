import {
  addDays,
  format,
} from "date-fns";
import { vi } from "date-fns/locale";
import { formatDateOnly } from "@/lib/utils";

const INVALID_CANDIDATE_SCORE = Number.NEGATIVE_INFINITY;

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
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();

  if (mode === "week") {
    const dayOfWeek = referenceDate.getUTCDay();
    const daysFromMonday = (dayOfWeek + 6) % 7;
    const start = new Date(Date.UTC(year, month, day - daysFromMonday));
    return {
      start,
      end: new Date(Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + 6
      )),
    };
  }
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 0)),
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

  const dayOfWeek = date.getUTCDay();
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
    const dayOfWeek = date.getUTCDay();
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

export type AssignmentRecord = {
  employeeId: string | null;
  storeId: string;
  shiftTemplateId: string;
  date: Date;
  slotIndex: number;
  shift: ShiftTime;
};

type AutoAssignOptions = {
  preserveManual?: boolean;
  contextAssignments?: AssignmentRecord[];
};

export function autoAssignShifts(
  slots: AssignmentSlot[],
  employees: EmployeeForSchedule[],
  shifts: ShiftTime[],
  options: boolean | AutoAssignOptions = true
): AssignmentSlot[] {
  const preserveManual =
    typeof options === "boolean" ? options : options.preserveManual ?? true;
  const contextAssignments =
    typeof options === "boolean" ? [] : options.contextAssignments ?? [];
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const result = slots.map((s) => ({ ...s }));
  const resultKeys = new Set(result.map(slotKey));

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
    }))
    .filter((a) => Boolean(a.shift));

  for (const assignment of contextAssignments) {
    if (!assignment.employeeId || resultKeys.has(recordKey(assignment))) continue;
    assigned.push(assignment);
  }

  const emptySlots = result.filter(
    (s) => !s.employeeId && !manualKeys.has(slotKey(s))
  );
  const orderedEmptySlots = orderSlotsForMonthlySpread(emptySlots, shiftMap);

  for (const slot of orderedEmptySlots) {
    const shift = shiftMap.get(slot.shiftTemplateId);
    if (!shift) continue;

    const candidates = employees
      .filter((e) => e.storeIds.includes(slot.storeId))
      .map((employee) => ({
        employee,
        score: scoreCandidate(employee, slot, shift, assigned, shifts),
      }))
      .filter((c) => c.score > INVALID_CANDIDATE_SCORE)
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
  return `${s.storeId}|${s.shiftTemplateId}|${formatDateOnly(s.date)}|${s.slotIndex}`;
}

function recordKey(s: AssignmentRecord): string {
  return `${s.storeId}|${s.shiftTemplateId}|${formatDateOnly(s.date)}|${s.slotIndex}`;
}

function orderSlotsForMonthlySpread(
  slots: AssignmentSlot[],
  shiftMap: Map<string, ShiftTime>
): AssignmentSlot[] {
  const slotsByDate = new Map<string, AssignmentSlot[]>();
  const metaByKey = new Map<string, { dateRank: number; dailyRank: number; baseRank: number }>();

  for (const slot of slots) {
    const dateKey = formatDateOnly(slot.date);
    const daySlots = slotsByDate.get(dateKey) ?? [];
    daySlots.push(slot);
    slotsByDate.set(dateKey, daySlots);
  }

  for (const [dateKey, daySlots] of slotsByDate) {
    const sortedDaySlots = [...daySlots].sort((a, b) => compareSlotBaseOrder(a, b, shiftMap));
    const date = sortedDaySlots[0]?.date;
    const dateRank = date ? getBalancedDateRank(date) : 0;
    const offset = date ? (date.getUTCDate() - 1) % Math.max(sortedDaySlots.length, 1) : 0;

    sortedDaySlots.forEach((slot, index) => {
      const dailyRank = (index - offset + sortedDaySlots.length) % sortedDaySlots.length;
      metaByKey.set(slotKey(slot), {
        dateRank,
        dailyRank,
        baseRank: index,
      });
    });
  }

  return [...slots].sort((a, b) => {
    const aMeta = metaByKey.get(slotKey(a));
    const bMeta = metaByKey.get(slotKey(b));

    if (aMeta && bMeta) {
      if (aMeta.dailyRank !== bMeta.dailyRank) return aMeta.dailyRank - bMeta.dailyRank;
      if (aMeta.dateRank !== bMeta.dateRank) return aMeta.dateRank - bMeta.dateRank;
      if (aMeta.baseRank !== bMeta.baseRank) return aMeta.baseRank - bMeta.baseRank;
    }

    return compareSlotBaseOrder(a, b, shiftMap);
  });
}

function compareSlotBaseOrder(
  a: AssignmentSlot,
  b: AssignmentSlot,
  shiftMap: Map<string, ShiftTime>
): number {
  const aShift = shiftMap.get(a.shiftTemplateId);
  const bShift = shiftMap.get(b.shiftTemplateId);
  const aDate = formatDateOnly(a.date);
  const bDate = formatDateOnly(b.date);

  if (aDate !== bDate) return aDate.localeCompare(bDate);
  if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
  if ((aShift?.sortOrder ?? 0) !== (bShift?.sortOrder ?? 0)) {
    return (aShift?.sortOrder ?? 0) - (bShift?.sortOrder ?? 0);
  }
  if (a.storeId !== b.storeId) return a.storeId.localeCompare(b.storeId);
  return a.shiftTemplateId.localeCompare(b.shiftTemplateId);
}

function getBalancedDateRank(date: Date): number {
  const dayIndex = date.getUTCDate() - 1;
  const daysInMonth = getUtcDaysInMonth(date);
  const bits = Math.ceil(Math.log2(daysInMonth));
  let rank = 0;

  for (let i = 0; i < bits; i++) {
    if (dayIndex & (1 << i)) {
      rank |= 1 << (bits - i - 1);
    }
  }

  return rank;
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
    return INVALID_CANDIDATE_SCORE;
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

  if (conflicts.length > 0) return INVALID_CANDIDATE_SCORE;

  let score = 0;
  const yesterday = formatDateOnly(addDays(slot.date, -1));
  const monthKey = getUtcMonthKey(slot.date);
  const slotDateKey = formatDateOnly(slot.date);
  const monthPaceLimit = getMonthlyPaceLimit(employee.maxShiftsPerMonth, slot.date);

  const employeeMonthAssignments = assigned.filter(
    (a) => a.employeeId === employee.id && getUtcMonthKey(a.date) === monthKey
  );
  const monthShiftsThroughDate = employeeMonthAssignments.filter(
    (a) => formatDateOnly(a.date) <= slotDateKey
  ).length;
  const overPaceShifts = Math.max(0, monthShiftsThroughDate + 1 - monthPaceLimit);

  const monthHours = employeeMonthAssignments.reduce(
    (sum, a) => sum + a.shift.durationHours,
    0
  );

  const weekShifts = assigned.filter(
    (a) => {
      if (a.employeeId !== employee.id) return false;
      const { start, end } = getDateRange("week", slot.date);
      const assignmentDate = formatDateOnly(a.date);
      return assignmentDate >= formatDateOnly(start) && assignmentDate <= formatDateOnly(end);
    }
  ).length;

  const monthShifts = employeeMonthAssignments.length;
  const storeMonthShifts = employeeMonthAssignments.filter(
    (a) => a.storeId === slot.storeId
  ).length;
  const shiftPositionMonthShifts = employeeMonthAssignments.filter((a) =>
    sameShiftPosition(a.shift, shift)
  ).length;

  score -= monthHours * 2;
  score -= monthShifts * 10;
  score -= weekShifts * 5;
  score -= storeMonthShifts * 18;
  score -= shiftPositionMonthShifts * 22;
  score -= overPaceShifts * 120;

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
  score += Math.max(0, employee.maxShiftsPerMonth - monthShifts) * 2;

  score += stableNoise(`${employee.id}|${slot.storeId}|${slot.shiftTemplateId}|${slotDateKey}`);

  return score;
}

function getMonthlyPaceLimit(maxShiftsPerMonth: number, date: Date): number {
  const elapsedDays = date.getUTCDate();
  const daysInMonth = getUtcDaysInMonth(date);
  return Math.ceil((maxShiftsPerMonth * elapsedDays) / daysInMonth);
}

function getUtcMonthKey(date: Date): string {
  return formatDateOnly(date).slice(0, 7);
}

function getUtcDaysInMonth(date: Date): number {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
}

function stableNoise(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return (hash % 100) / 20;
}

function normalizeShiftName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function sameShiftPosition(a: ShiftTime, b: ShiftTime): boolean {
  return a.sortOrder === b.sortOrder || normalizeShiftName(a.name) === normalizeShiftName(b.name);
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
    const exceededShifts = (employeeAssignments.length + 1) - 3;
    conflicts.push({
      type: "MAX_SHIFTS",
      message: `Mỗi nhân viên chỉ được làm tối đa 3 ca trong một ngày. Số ca đã vượt trong ngày: ${exceededShifts} ca`,
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
      !(existing.storeId === storeId && existing.shiftTemplateId === shiftTemplateId) &&
      sameShiftPosition(targetShift, existing.shiftTemplate)
    ) {
      conflicts.push({
        type: "OVERLAP",
        message: `Nhân viên đã làm ${existing.shiftTemplate.name} trong ngày này, không thể xếp thêm ${targetShift.name} ở cửa hàng khác`,
        employeeId,
        date: dateStr,
      });
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
        getUtcMonthKey(a.date) === getUtcMonthKey(date)
    ).length;

    if (monthShifts >= employee.maxShiftsPerMonth) {
      const exceededShifts = (monthShifts + 1) - employee.maxShiftsPerMonth;
      conflicts.push({
        type: "MAX_SHIFTS",
        message: `Vượt số ca tối đa/tháng (${employee.maxShiftsPerMonth} ca). Số ca đã vượt trong tháng: ${exceededShifts} ca`,
        employeeId,
        date: dateStr,
      });
    }

    const monthHours = allAssignments
      .filter(
        (a) =>
          a.employeeId === employeeId &&
          getUtcMonthKey(a.date) === getUtcMonthKey(date)
      )
      .reduce((sum, a) => sum + a.shiftTemplate.durationHours, 0);

    const newTotalHours = monthHours + targetShift.durationHours;
    if (newTotalHours > employee.maxHoursPerMonth) {
      const exceededHours = newTotalHours - employee.maxHoursPerMonth;
      conflicts.push({
        type: "MAX_HOURS",
        message: `Vượt số giờ tối đa/tháng (${employee.maxHoursPerMonth}h). Số giờ đã vượt trong tháng: ${exceededHours} giờ`,
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
  const days: Date[] = [];
  let currentTime = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const endTime = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  while (currentTime <= endTime) {
    days.push(new Date(currentTime));
    currentTime += 24 * 60 * 60 * 1000;
  }

  return days;
}
