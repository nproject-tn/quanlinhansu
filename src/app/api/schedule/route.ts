import { NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import {
  autoAssignShifts,
  buildAssignmentSlots,
  findUnfilledShifts,
  getDateRange,
  getDaysInRange,
  type AssignmentRecord,
} from "@/lib/schedule-engine";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { isMissingStoreLogoColumn } from "@/lib/store-logo-fallback";
import { scheduleGenerateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") ?? "week") as "week" | "month";
    const referenceDate = parseDateOnly(searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd"));
    const storeId = searchParams.get("storeId");

    const { start, end } = getDateRange(mode, referenceDate);
    const dates = getDaysInRange(start, end);
    const isEmployee = session!.user.role === "EMPLOYEE";

    let stores;
    try {
      stores = await prisma.store.findMany({
        where: {
          isActive: true,
          ...(storeId ? { id: storeId } : {}),
        },
        select: { id: true, name: true, logoUrl: true },
        orderBy: { name: "asc" },
      });
    } catch (storeError) {
      if (!isMissingStoreLogoColumn(storeError)) {
        throw storeError;
      }

      stores = await prisma.store.findMany({
        where: {
          isActive: true,
          ...(storeId ? { id: storeId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    }

    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return NextResponse.json({
        mode,
        start: formatDateOnly(start),
        end: formatDateOnly(end),
      stores: [],
        shifts: [],
        rules: [],
        overrides: [],
        dayNotes: [],
        slots: [],
        employees: [],
        unfilled: [],
        stats: { totalSlots: 0, filledSlots: 0, unfilledCount: 0 },
      });
    }

    const [shifts, rules, overrides, existing, employees, overtimes] = await prisma.$transaction([
      prisma.shiftTemplate.findMany({
        where: { storeId: { in: storeIds }, isActive: true },
        select: {
          id: true,
          storeId: true,
          name: true,
          startTime: true,
          endTime: true,
          durationHours: true,
          sortOrder: true,
        },
        orderBy: [{ storeId: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.staffingRule.findMany({
        where: { storeId: { in: storeIds } },
        select: {
          storeId: true,
          shiftTemplateId: true,
          dayOfWeek: true,
          requiredStaff: true,
        },
      }),
      prisma.staffingOverride.findMany({
        where: {
          storeId: { in: storeIds },
          date: { gte: start, lte: end },
        },
        select: {
          storeId: true,
          shiftTemplateId: true,
          date: true,
          requiredStaff: true,
        },
      }),
      prisma.shiftAssignment.findMany({
        where: {
          storeId: { in: storeIds },
          date: { gte: start, lte: end },
        },
        select: {
          id: true,
          storeId: true,
          shiftTemplateId: true,
          date: true,
          slotIndex: true,
          employeeId: true,
          faults: { select: { id: true, note: true, evidenceUrl: true, createdAt: true } },
        },
      }),
      prisma.employee.findMany({
        where: {
          stores: { some: { storeId: { in: storeIds } } },
        },
        select: {
          id: true,
          name: true,
          position: true,
          employmentType: true,
          maxShiftsPerMonth: true,
          maxHoursPerMonth: true,
          isActive: true,
          deletedAt: true,
          stores: { select: { storeId: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.shiftOvertime.findMany({
        where: {
          storeId: { in: storeIds },
          date: { gte: start, lte: end },
        },
        select: {
          id: true,
          storeId: true,
          shiftTemplateId: true,
          date: true,
          employeeId: true,
          hours: true,
        },
      }),
    ]);

    const dayNotes = await prisma.scheduleDayNote
      .findMany({
        where: {
          date: { gte: start, lte: end },
        },
        select: {
          date: true,
          note: true,
          colorKey: true,
        },
        orderBy: { date: "asc" },
      })
      .catch((noteError) => {
        console.error("GET /api/schedule day notes failed", noteError);
        return [];
      });

    const slotsRaw = buildAssignmentSlots(
      dates,
      stores,
      shifts,
      rules,
      overrides,
      existing.map((e) => ({
        id: e.id,
        storeId: e.storeId,
        shiftTemplateId: e.shiftTemplateId,
        date: e.date,
        slotIndex: e.slotIndex,
        employeeId: e.employeeId,
        faults: e.faults,
      }))
    );

    const unfilled = findUnfilledShifts(slotsRaw, stores, shifts);

    const slots = slotsRaw.map((s) => ({
      ...s,
      date: formatDateOnly(s.date),
    }));

    return NextResponse.json({
      mode,
      start: formatDateOnly(start),
      end: formatDateOnly(end),
      stores,
      shifts,
      rules,
      overrides,
      dayNotes: dayNotes.map((note) => ({
        ...note,
        date: formatDateOnly(note.date),
      })),
      overtimes: overtimes.map((o) => ({
        id: o.id,
        storeId: o.storeId,
        shiftTemplateId: o.shiftTemplateId,
        date: formatDateOnly(o.date),
        employeeId: o.employeeId,
        hours: o.hours,
      })),
      slots,
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name,
        position: e.position,
        employmentType: e.employmentType,
        maxShiftsPerMonth: e.maxShiftsPerMonth,
        maxHoursPerMonth: e.maxHoursPerMonth,
        isActive: e.isActive,
        deletedAt: e.deletedAt,
        storeIds: e.stores.map((s) => s.storeId),
      })),
      unfilled,
      stats: {
        totalSlots: slots.length,
        filledSlots: slots.filter((s) => s.employeeId).length,
        unfilledCount: unfilled.length,
      },
    });
  } catch (error) {
    console.error("GET /api/schedule failed", error);
    return NextResponse.json({ error: "Không tải được lịch xếp ca" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
    if (error) return error;

    const body = await request.json();
    const parsed = scheduleGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const referenceDate = parseDateOnly(parsed.data.referenceDate);
    const { start, end } = getDateRange(parsed.data.mode, referenceDate);
    const planningStart = getDateRange("month", start).start;
    const planningEnd = getDateRange("month", end).end;
    const planningDates = getDaysInRange(planningStart, planningEnd);

    const stores = await prisma.store.findMany({
      where: {
        isActive: true,
        ...(parsed.data.storeIds?.length
          ? { id: { in: parsed.data.storeIds } }
          : {}),
      },
      select: { id: true, name: true },
    });

    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return NextResponse.json(
        { error: "Chưa có cửa hàng hoạt động để xếp ca" },
        { status: 400 }
      );
    }

    const activeStores = await prisma.store.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const activeStoreIds = activeStores.map((store) => store.id);

    const [shifts, contextShifts, rules, overrides, existing, contextExisting, employees] =
      await prisma.$transaction([
        prisma.shiftTemplate.findMany({
          where: { storeId: { in: storeIds }, isActive: true },
          select: {
            id: true,
            storeId: true,
            name: true,
            startTime: true,
            endTime: true,
            durationHours: true,
            sortOrder: true,
          },
          orderBy: [{ storeId: "asc" }, { sortOrder: "asc" }],
        }),
        prisma.shiftTemplate.findMany({
          where: { storeId: { in: activeStoreIds }, isActive: true },
          select: {
            id: true,
            storeId: true,
            name: true,
            startTime: true,
            endTime: true,
            durationHours: true,
            sortOrder: true,
          },
          orderBy: [{ storeId: "asc" }, { sortOrder: "asc" }],
        }),
        prisma.staffingRule.findMany({
          where: { storeId: { in: storeIds } },
          select: {
            storeId: true,
            shiftTemplateId: true,
            dayOfWeek: true,
            requiredStaff: true,
          },
        }),
        prisma.staffingOverride.findMany({
          where: {
            storeId: { in: storeIds },
            date: { gte: planningStart, lte: planningEnd },
          },
          select: {
            storeId: true,
            shiftTemplateId: true,
            date: true,
            requiredStaff: true,
          },
        }),
        prisma.shiftAssignment.findMany({
          where: {
            storeId: { in: storeIds },
            date: { gte: planningStart, lte: planningEnd },
          },
          select: {
            id: true,
            storeId: true,
            shiftTemplateId: true,
            date: true,
            slotIndex: true,
            employeeId: true,
            isManual: true,
          },
        }),
        prisma.shiftAssignment.findMany({
          where: {
            storeId: { in: activeStoreIds },
            date: { gte: planningStart, lte: planningEnd },
          },
          select: {
            id: true,
            storeId: true,
            shiftTemplateId: true,
            date: true,
            slotIndex: true,
            employeeId: true,
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
        prisma.employee.findMany({
          where: {
            isActive: true,
            stores: { some: { storeId: { in: storeIds } } },
          },
          select: {
            id: true,
            name: true,
            maxShiftsPerMonth: true,
            maxHoursPerMonth: true,
            stores: { select: { storeId: true } },
          },
          orderBy: { name: "asc" },
        }),
      ]);

    let slots = buildAssignmentSlots(
      planningDates,
      stores,
      shifts,
      rules,
      overrides,
      existing.map((e) => ({
        id: e.id,
        storeId: e.storeId,
        shiftTemplateId: e.shiftTemplateId,
        date: e.date,
        slotIndex: e.slotIndex,
        employeeId: e.employeeId,
      }))
    );

    const slotKey = (
      storeId: string,
      shiftTemplateId: string,
      date: Date,
      slotIndex: number
    ) => `${storeId}|${shiftTemplateId}|${formatDateOnly(date)}|${slotIndex}`;
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 7);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const isTargetDate = (date: Date) => date >= start && date <= end && date >= today;
    const selectedSlotKeys = new Set(
      slots.map((slot) => slotKey(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex))
    );
    const targetManualAssignments = new Map(
      existing
        .filter((assignment) => assignment.isManual && isTargetDate(assignment.date))
        .map((assignment) => [
          slotKey(
            assignment.storeId,
            assignment.shiftTemplateId,
            assignment.date,
            assignment.slotIndex
          ),
          assignment,
        ])
    );

    for (const slot of slots) {
      if (!isTargetDate(slot.date)) continue;

      const key = slotKey(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex);
      const manual = targetManualAssignments.get(key);

      if (parsed.data.preserveManual && manual) {
        slot.employeeId = manual.employeeId;
        slot.assignmentId = manual.id;
      } else {
        slot.employeeId = null;
        slot.assignmentId = undefined;
      }
    }

    const contextAssignments: AssignmentRecord[] = contextExisting
      .filter((assignment) => !selectedSlotKeys.has(
        slotKey(
          assignment.storeId,
          assignment.shiftTemplateId,
          assignment.date,
          assignment.slotIndex
        )
      ))
      .map((assignment) => ({
        employeeId: assignment.employeeId,
        storeId: assignment.storeId,
        shiftTemplateId: assignment.shiftTemplateId,
        date: assignment.date,
        slotIndex: assignment.slotIndex,
        shift: assignment.shiftTemplate,
      }));

    slots = autoAssignShifts(
      slots,
      employees.map((e) => ({
        id: e.id,
        name: e.name,
        maxShiftsPerMonth: e.maxShiftsPerMonth,
        maxHoursPerMonth: e.maxHoursPerMonth,
        storeIds: e.stores.map((s) => s.storeId),
      })),
      contextShifts,
      {
        preserveManual: true,
        contextAssignments,
      }
    );

    const manualKeys = new Set(
      existing
        .filter((assignment) => parsed.data.preserveManual && assignment.isManual && isTargetDate(assignment.date))
        .map((assignment) =>
          slotKey(
            assignment.storeId,
            assignment.shiftTemplateId,
            assignment.date,
            assignment.slotIndex
          )
        )
    );

    await prisma.shiftAssignment.deleteMany({
      where: {
        storeId: { in: storeIds },
        date: { gte: start >= today ? start : today, lte: end },
        ...(parsed.data.preserveManual ? { isManual: false } : {}),
      },
    });

    const targetSlots = slots.filter((slot) => isTargetDate(slot.date));
    const toCreate = targetSlots
      .filter((slot) => slot.employeeId)
      .filter((slot) => {
        const key = slotKey(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex);
        return !manualKeys.has(key);
      })
      .map((slot) => ({
        storeId: slot.storeId,
        shiftTemplateId: slot.shiftTemplateId,
        date: slot.date,
        slotIndex: slot.slotIndex,
        employeeId: slot.employeeId!,
        isManual: false,
      }));

    if (toCreate.length > 0) {
      await prisma.shiftAssignment.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    const unfilled = findUnfilledShifts(targetSlots, stores, shifts);

    return NextResponse.json({
      success: true,
      filled: targetSlots.filter((s) => s.employeeId).length,
      unfilled,
      message:
        unfilled.length > 0
          ? `Còn ${unfilled.length} ca trống. Cần nhân viên làm thêm ca hoặc tuyển thêm nhân viên.`
          : "Đã xếp ca thành công cho tất cả vị trí.",
    });
  } catch (err) {
    console.error("POST /api/schedule error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Lỗi server khi xếp ca. Vui lòng thử lại.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") ?? "week") as "day" | "week" | "month";
    const referenceDate = parseDateOnly(searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd"));
    const storeId = searchParams.get("storeId");

    const { start, end } = getDateRange(mode, referenceDate);

    let storeIds: string[] = [];
    if (storeId) {
      storeIds = [storeId];
    } else {
      const activeStores = await prisma.store.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      storeIds = activeStores.map((store) => store.id);
    }

    if (storeIds.length === 0) {
      return NextResponse.json({ message: "Không có cửa hàng nào để xoá ca" });
    }

    const { count } = await prisma.shiftAssignment.deleteMany({
      where: {
        storeId: { in: storeIds },
        date: { gte: start, lte: end },
      },
    });

    return NextResponse.json({ message: `Đã xoá thành công ${count} ca` });
  } catch (error: any) {
    console.error("Lỗi xoá ca:", error);
    return NextResponse.json({ error: "Lỗi server khi xoá ca" }, { status: 500 });
  }
}
