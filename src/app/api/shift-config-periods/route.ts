import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { shiftConfigPeriodSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";
import { formatDateOnly, parseDateOnly, formatDateVN } from "@/lib/utils";
import { calcDurationHours, getDefaultShiftTime } from "@/lib/shift-utils";
import { getDateRange } from "@/lib/schedule-engine";

export async function GET(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], [
    { module: "schedule", action: "VIEW" },
    { module: "shift_config", action: "VIEW" },
  ]);
  if (error || !companyId) return error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  const month = searchParams.get("month"); // e.g. "2026-09"

  let dateFilter = {};
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const monthStart = parseDateOnly(`${month}-01`);
    const monthEnd = getDateRange("month", monthStart).end;
    dateFilter = {
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    };
  }

  const periods = await prisma.shiftConfigPeriod.findMany({
    where: {
      companyId,
      ...(storeId ? { storeId } : {}),
      ...dateFilter,
    },
    include: {
      shiftTemplates: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      store: {
        select: { id: true, name: true, logoUrl: true },
      },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    periods.map((p) => ({
      id: p.id,
      storeId: p.storeId,
      companyId: p.companyId,
      name: p.name,
      startDate: formatDateOnly(p.startDate),
      endDate: formatDateOnly(p.endDate),
      store: p.store,
      shiftCount: p.shiftTemplates.length,
      shiftTemplates: p.shiftTemplates.map((s) => ({
        id: s.id,
        storeId: s.storeId,
        periodId: s.periodId,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        durationHours: s.durationHours,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
      })),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  );
}

export async function POST(request: Request) {
  const { error, companyId, user } = await requireAuth(["OWNER"], {
    module: "shift_config",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  const body = await request.json();
  const parsed = shiftConfigPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeId, name, startDate: startStr, endDate: endStr, cloneFromPeriodId, initialShiftsCount } = parsed.data;
  const startDate = parseDateOnly(startStr);
  const endDate = parseDateOnly(endStr);

  if (startDate > endDate) {
    return NextResponse.json(
      { error: "Ngày bắt đầu không được lớn hơn ngày kết thúc." },
      { status: 400 }
    );
  }

  // 1. Kiểm tra quy tắc chống trùng ngày tuyệt đối trong cùng cửa hàng
  // Điều kiện giao nhau giữa 2 khoảng [startDate, endDate] và [p.startDate, p.endDate]:
  // startDate <= p.endDate && p.startDate <= endDate
  const overlapping = await prisma.shiftConfigPeriod.findFirst({
    where: {
      companyId,
      storeId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  if (overlapping) {
    return NextResponse.json(
      {
        error: `Khoảng ngày ${formatDateVN(startStr)} - ${formatDateVN(endStr)} không hợp lệ vì bị trùng ngày với bảng cấu hình "${overlapping.name}" (${formatDateVN(formatDateOnly(overlapping.startDate))} - ${formatDateVN(formatDateOnly(overlapping.endDate))}) của cửa hàng.`,
      },
      { status: 400 }
    );
  }

  // 2. Tạo ShiftConfigPeriod
  const period = await prisma.shiftConfigPeriod.create({
    data: {
      companyId,
      storeId,
      name,
      startDate,
      endDate,
    },
  });

  // 3. Khởi tạo danh sách ca
  if (cloneFromPeriodId) {
    // Sao chép ca từ bảng khác
    const sourceShifts = await prisma.shiftTemplate.findMany({
      where: { periodId: cloneFromPeriodId, companyId, isActive: true },
      include: { staffingRules: true },
      orderBy: { sortOrder: "asc" },
    });

    for (const src of sourceShifts) {
      const newShift = await prisma.shiftTemplate.create({
        data: {
          companyId,
          storeId,
          periodId: period.id,
          name: src.name,
          startTime: src.startTime,
          endTime: src.endTime,
          durationHours: src.durationHours,
          sortOrder: src.sortOrder,
          isActive: true,
        },
      });

      if (src.staffingRules.length > 0) {
        await prisma.staffingRule.createMany({
          data: src.staffingRules.map((rule) => ({
            companyId,
            storeId,
            shiftTemplateId: newShift.id,
            dayOfWeek: rule.dayOfWeek,
            requiredStaff: rule.requiredStaff,
          })),
        });
      }
    }
  } else if (initialShiftsCount && initialShiftsCount > 0) {
    // Tạo số ca mặc định ban đầu
    for (let i = 0; i < initialShiftsCount; i++) {
      const def = getDefaultShiftTime(i);
      const shiftName = `Ca ${i + 1}`;
      const durationHours = calcDurationHours(def.startTime, def.endTime);

      const createdShift = await prisma.shiftTemplate.create({
        data: {
          companyId,
          storeId,
          periodId: period.id,
          name: shiftName,
          startTime: def.startTime,
          endTime: def.endTime,
          durationHours,
          sortOrder: i,
          isActive: true,
        },
      });

      await prisma.staffingRule.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          companyId,
          storeId,
          shiftTemplateId: createdShift.id,
          dayOfWeek,
          requiredStaff: 1,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (user) {
    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "CREATE",
      module: "shift_config",
      targetType: "ShiftConfigPeriod",
      targetId: period.id,
      targetName: period.name,
      description: `Đã tạo bảng cấu hình ca mới "${period.name}" (${formatDateVN(startStr)} - ${formatDateVN(endStr)})`,
      details: {
        storeId,
        startDate: startStr,
        endDate: endStr,
        cloneFromPeriodId: cloneFromPeriodId || null,
      },
    });
  }

  const result = await prisma.shiftConfigPeriod.findUnique({
    where: { id: period.id },
    include: {
      shiftTemplates: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      store: { select: { id: true, name: true, logoUrl: true } },
    },
  });

  return NextResponse.json({
    success: true,
    period: {
      ...result,
      startDate: formatDateOnly(result!.startDate),
      endDate: formatDateOnly(result!.endDate),
    },
  });
}
