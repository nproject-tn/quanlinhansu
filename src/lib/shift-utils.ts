/** Tính số giờ giữa hai mốc HH:mm */
export function calcDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return Math.round(((end - start) / 60) * 10) / 10;
}

export function calcMaxShiftsFromHours(
  maxHoursPerMonth: number,
  avgShiftHours: number
): number {
  if (!avgShiftHours || avgShiftHours <= 0) return 0;
  return Math.floor(maxHoursPerMonth / avgShiftHours);
}

export function calcMaxHoursFromShifts(
  maxShiftsPerMonth: number,
  avgShiftHours: number
): number {
  return Math.round(maxShiftsPerMonth * avgShiftHours * 10) / 10;
}

export const DEFAULT_SHIFT_HOURS = 3;

export const DEFAULT_SHIFT_TIMES = [
  { startTime: "08:00", endTime: "11:00" },
  { startTime: "11:00", endTime: "14:00" },
  { startTime: "14:00", endTime: "17:00" },
  { startTime: "17:00", endTime: "20:00" },
  { startTime: "20:00", endTime: "23:00" },
  { startTime: "23:00", endTime: "02:00" },
  { startTime: "02:00", endTime: "05:00" },
  { startTime: "05:00", endTime: "08:00" },
] as const;

export function getDefaultShiftTime(index: number) {
  if (index >= 0 && index < DEFAULT_SHIFT_TIMES.length) {
    return DEFAULT_SHIFT_TIMES[index];
  }
  const startHour = (8 + index * 3) % 24;
  const endHour = (startHour + 3) % 24;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    startTime: `${pad(startHour)}:00`,
    endTime: `${pad(endHour)}:00`,
  };
}
