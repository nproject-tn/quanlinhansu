import { z } from "zod";

export const employeeSchema = z
  .object({
    name: z.string().min(1, "Tên không được để trống"),
    phone: z.string().optional(),
    email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
    employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
    position: z.string().min(1, "Chức vụ không được để trống"),
    salaryType: z.enum(["FIXED_MONTHLY", "HOURLY"]),
    monthlySalary: z.number().optional().nullable(),
    hourlyRate: z.number().optional().nullable(),
    maxShiftsPerWeek: z.number().min(1).max(28).optional(),
    maxShiftsPerMonth: z.number().min(1, "Số ca/tháng tối thiểu là 1").max(300, "Số ca/tháng không được vượt quá 300"),
    maxHoursPerMonth: z.number().min(1, "Số giờ/tháng tối thiểu là 1").max(720, "Số giờ/tháng không được vượt quá 720"),
    storeIds: z.array(z.string()).min(1, "Chọn ít nhất 1 cửa hàng"),
    storeMaxHours: z.record(z.string(), z.number().min(0).max(720).nullable()).optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.storeMaxHours && data.maxHoursPerMonth && data.storeIds && data.storeIds.length > 0) {
      let totalStoreHours = 0;
      for (const storeId of data.storeIds) {
        const hours = data.storeMaxHours[storeId];
        if (hours !== undefined && hours !== null && !isNaN(hours)) {
          totalStoreHours += hours;
        }
      }
      if (totalStoreHours > data.maxHoursPerMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Tổng số giờ phân bổ cho các cửa hàng (${totalStoreHours}h) không được vượt quá số giờ tối đa/tháng của nhân viên (${data.maxHoursPerMonth}h). Vui lòng điều chỉnh lại.`,
          path: ["storeMaxHours"],
        });
      }
    }
  });

export const storeSchema = z.object({
  name: z.string().min(1, "Tên cửa hàng không được để trống"),
  address: z.string().optional(),
  logoUrl: z.string().optional().or(z.literal("")),
  shiftsPerDay: z.number().min(1).optional().default(3),
  isActive: z.boolean().default(true),
});

export const shiftConfigPeriodSchema = z.object({
  storeId: z.string().min(1, "Vui lòng chọn cửa hàng"),
  name: z.string().min(1, "Tên bảng cấu hình không được để trống"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng YYYY-MM-DD"),
  cloneFromPeriodId: z.string().optional(),
  initialShiftsCount: z.number().min(1).max(12).optional(),
});

export const shiftConfigPeriodUpdateSchema = z.object({
  name: z.string().min(1, "Tên bảng cấu hình không được để trống").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng YYYY-MM-DD").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng YYYY-MM-DD").optional(),
});

export const shiftTemplateSchema = z.object({
  storeId: z.string(),
  periodId: z.string().optional().nullable(),
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Định dạng HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Định dạng HH:mm"),
  durationHours: z.number().min(0.5).max(24),
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
  mode: z.enum(["day", "week", "month"]),
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
