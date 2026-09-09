import { formatDateVN } from "./utils";

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

/**
 * Kiểm tra xem 2 ca làm việc có bị lọt lòng vào nhau hay không
 * Trả về true nếu ca B lọt lòng trong ca A, HOẶC ca A lọt lòng trong ca B (bao gồm cả trùng hệt nhau).
 * Các ca giao thoa gối đầu (ví dụ: 08:00 - 11:00 và 09:00 - 12:00) sẽ trả về false (hợp lệ).
 */
export function isShiftContained(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const [shA, smA] = startA.split(":").map(Number);
  const [ehA, emA] = endA.split(":").map(Number);
  const [shB, smB] = startB.split(":").map(Number);
  const [ehB, emB] = endB.split(":").map(Number);

  const sA = shA * 60 + smA;
  let durA = (ehA * 60 + emA) - sA;
  if (durA <= 0) durA += 24 * 60;

  const sB = shB * 60 + smB;
  let durB = (ehB * 60 + emB) - sB;
  if (durB <= 0) durB += 24 * 60;

  // Kiểm tra B có nằm lọt lòng hoàn toàn trong A không
  const offsetStartB = (sB - sA + 24 * 60) % (24 * 60);
  const offsetEndB = offsetStartB + durB;
  if (offsetStartB >= 0 && offsetEndB <= durA) {
    return true;
  }

  // Kiểm tra A có nằm lọt lòng hoàn toàn trong B không
  const offsetStartA = (sA - sB + 24 * 60) % (24 * 60);
  const offsetEndA = offsetStartA + durA;
  if (offsetStartA >= 0 && offsetEndA <= durB) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra xung đột thời gian (trùng hệt hoặc lọt lòng) giữa ca mới và ca đã có
 */
export function getShiftContainmentError(
  candidate: { startTime: string; endTime: string },
  existing: { name: string; startTime: string; endTime: string }
): string | null {
  if (candidate.startTime === existing.startTime && candidate.endTime === existing.endTime) {
    return `Cửa hàng này đã có ca "${existing.name}" với khung giờ ${existing.startTime} - ${existing.endTime}. Không thể tạo 2 ca có giờ làm giống hệt nhau.`;
  }

  if (isShiftContained(existing.startTime, existing.endTime, candidate.startTime, candidate.endTime)) {
    return `Khung giờ ${candidate.startTime} - ${candidate.endTime} không hợp lệ vì bị trùng bên trong ca "${existing.name}" (${existing.startTime} - ${existing.endTime}) của cửa hàng.`;
  }

  return null;
}

/**
 * Lấy tên gốc của bảng cấu hình (loại bỏ phần ngày trong ngoặc đơn nếu có)
 * Ví dụ: "Đợt 2 (11/10/2026 - 20/10/2026)" => "Đợt 2"
 *        "Đợt 1 (09/10/2026)" => "Đợt 1"
 *        "Ca cuối tuần" => "Ca cuối tuần"
 */
export function getPeriodBaseName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/\s*\(\s*\d{1,2}[\d\/\s\.-]*\)\s*$/, "").trim();
}

/**
 * Tự động cập nhật phần ngày phía sau trong tên bảng cấu hình ca theo khoảng ngày được chọn.
 * Ví dụ:
 * - "Đợt 1 (01/10/2026 - 10/10/2026)" khi đổi sang 01/10 - 09/10 => "Đợt 1 (01/10/2026 - 09/10/2026)"
 * - "Đợt 4 (10/10/2026 - 10/10/2026)" khi là 1 ngày 10/10 => "Đợt 4 (10/10/2026)"
 * - "Đợt 1" khi chọn 01/10 - 09/10 => "Đợt 1 (01/10/2026 - 09/10/2026)"
 */
export function updatePeriodNameWithDates(
  currentName: string,
  startDate?: string,
  endDate?: string,
  fallbackPrefix = "Đợt"
): string {
  if (!startDate && !endDate) return currentName;

  // Import dynamically or use date formatting
  const startVN = startDate ? formatDateVN(startDate) : "";
  const endVN = endDate ? formatDateVN(endDate) : "";

  let rangeLabel = "";
  if (startDate && endDate) {
    rangeLabel = startDate === endDate ? startVN : `${startVN} - ${endVN}`;
  } else {
    rangeLabel = startVN || endVN;
  }

  if (!rangeLabel) return currentName;

  // Loại bỏ phần đuôi ngày trong ngoặc đơn ở cuối chuỗi nếu có
  // Khớp với (DD/MM/YYYY - DD/MM/YYYY), (DD/MM/YYYY), (DD - DD), v.v.
  const cleanPrefix = getPeriodBaseName(currentName);
  const prefix = cleanPrefix || fallbackPrefix;
  return `${prefix} (${rangeLabel})`;
}

/**
 * Tự động xác định tên theo thứ tự "Đợt N" cho bảng cấu hình mới trong một tháng.
 * Quy tắc:
 * - Đếm số lượng bảng cấu hình hiện có trong tháng (count).
 * - Bảng tiếp theo luôn có số thứ tự là count + 1.
 * - Cho dù bảng đầu tiên người dùng có đổi tên thành "Khai trương" hay tên gì khác, bảng thứ 2 vẫn luôn là "Đợt 2".
 * - Nếu số thứ tự đã bị trùng thủ công, tự động tăng dần tìm số tiếp theo còn trống.
 */
export function getNextPeriodSequentialName(
  existingPeriods: Array<{ name?: string | null }>
): string {
  const count = existingPeriods.length;
  let nextNum = count + 1;

  const existingNumbers = new Set<number>();
  for (const p of existingPeriods) {
    if (!p.name) continue;
    const base = getPeriodBaseName(p.name);
    const match = base.match(/^Đợt\s+(\d+)$/i);
    if (match) {
      existingNumbers.add(parseInt(match[1], 10));
    }
  }

  while (existingNumbers.has(nextNum)) {
    nextNum++;
  }

  return `Đợt ${nextNum}`;
}

/** Lấy ngày đầu tiên và ngày cuối cùng của tháng theo chuỗi YYYY-MM */
export function getMonthDateLimits(monthStr: string): { minDate: string; maxDate: string } {
  const [y, m] = monthStr.split("-").map(Number);
  const minDate = `${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const maxDate = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { minDate, maxDate };
}

/** Lấy chuỗi tháng kế tiếp từ chuỗi YYYY-MM (ví dụ "2026-11" -> "2026-12") */
export function getNextMonthStr(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  if (m === 12) {
    return `${y + 1}-01`;
  }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

