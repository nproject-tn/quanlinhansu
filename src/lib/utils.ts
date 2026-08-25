import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse yyyy-MM-dd to a stable UTC-midnight Date for Postgres DATE columns */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format YYYY-MM-DD or date string to DD/MM/YYYY */
export function formatDateVN(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = String(dateStr).trim().split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return String(dateStr);
}

/** Format week range label: e.g. "20-26/07/2026" or "29/06 - 05/07/2026" */
export function formatWeekRangeLabel(startDateStr?: string | null, endDateStr?: string | null): string {
  if (!startDateStr || !endDateStr) return "";
  const parts1 = String(startDateStr).trim().split("-");
  const parts2 = String(endDateStr).trim().split("-");
  if (parts1.length !== 3 || parts2.length !== 3) {
    return `${startDateStr} - ${endDateStr}`;
  }
  const [y1, m1, d1] = parts1;
  const [y2, m2, d2] = parts2;

  // Case 1: Same month & same year: "20-26/07/2026"
  if (y1 === y2 && m1 === m2) {
    return `${d1}-${d2}/${m1}/${y1}`;
  }

  // Case 2: Different month, same year: "29/06 - 05/07/2026"
  if (y1 === y2) {
    return `${d1}/${m1} - ${d2}/${m2}/${y1}`;
  }

  // Case 3: Different year: "28/12/2026 - 03/01/2027"
  return `${d1}/${m1}/${y1} - ${d2}/${m2}/${y2}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const DAY_NAMES = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  SCHEDULER: "Người xếp ca",
  EMPLOYEE: "Nhân viên",
};
