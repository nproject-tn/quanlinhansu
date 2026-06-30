import { z } from "zod";

export const employeeSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  phone: z.string().optional(),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
  position: z.string().min(1, "Chức vụ không được để trống"),
  salaryType: z.enum(["FIXED_MONTHLY", "HOURLY"]),
  monthlySalary: z.number().optional().nullable(),
  hourlyRate: z.number().optional().nullable(),
  maxShiftsPerWeek: z.number().min(1).max(14).optional(),
  maxShiftsPerMonth: z.number().min(1).max(62),
  maxHoursPerMonth: z.number().min(1).max(300),
  storeIds: z.array(z.string()).min(1, "Chọn ít nhất 1 cửa hàng"),
  isActive: z.boolean().default(true),
});

export const storeSchema = z.object({
  name: z.string().min(1, "Tên cửa hàng không được để trống"),
  address: z.string().optional(),
  logoUrl: z.string().optional().or(z.literal("")),
  shiftsPerDay: z.number().min(1).optional().default(3),
  isActive: z.boolean().default(true),
});

export const shiftTemplateSchema = z.object({
  storeId: z.string(),
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Định dạng HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Định dạng HH:mm"),
  durationHours: z.number().min(0.5).max(12),
  sortOrder: z.number().min(0),
  isActive: z.boolean().default(true),
});

export const staffingRuleSchema = z.object({
  storeId: z.string(),
  shiftTemplateId: z.string(),
  dayOfWeek: z.number().min(0).max(6),
  requiredStaff: z.number().min(0).max(10),
});

export const staffingOverrideSchema = z.object({
  storeId: z.string(),
  shiftTemplateId: z.string(),
  date: z.string(),
  requiredStaff: z.number().min(0).max(10),
});

export const scheduleDayNoteSchema = z.object({
  date: z.string(),
  note: z.string().trim().min(1).max(120),
  colorKey: z.enum(["amber", "rose", "blue", "emerald", "violet", "slate"]),
});

export const scheduleGenerateSchema = z.object({
  mode: z.enum(["week", "month"]),
  referenceDate: z.string(),
  storeIds: z.array(z.string()).optional(),
  preserveManual: z.boolean().default(true),
});

export const assignmentUpdateSchema = z.object({
  assignmentId: z.string().optional(),
  storeId: z.string(),
  shiftTemplateId: z.string(),
  date: z.string(),
  slotIndex: z.number(),
  employeeId: z.string().nullable(),
  requiredStaff: z.number(),
  confirmOverCapacity: z.boolean().default(false),
});

export const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "SCHEDULER", "EMPLOYEE"]),
  employeeId: z.string().optional().nullable(),
});
