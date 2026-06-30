import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { calcDurationHours, getDefaultShiftTime } from "@/lib/shift-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id: storeId } = await params;
  const body = await request.json();
  const shiftsPerDay = Number(body.shiftsPerDay);

  if (!Number.isFinite(shiftsPerDay) || shiftsPerDay < 1) {
    return NextResponse.json({ error: "Số ca/ngày phải lớn hơn 0" }, { status: 400 });
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { shiftsPerDay },
  });

  const existing = await prisma.shiftTemplate.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
  });

  for (let i = 0; i < shiftsPerDay; i++) {
    const def = getDefaultShiftTime(i);
    const name = `Ca ${i + 1}`;
    const durationHours = calcDurationHours(def.startTime, def.endTime);

    const found = existing.find((s) => s.name === name);
    if (found) {
      await prisma.shiftTemplate.update({
        where: { id: found.id },
        data: { isActive: true, sortOrder: i },
      });
      await prisma.staffingRule.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          storeId,
          shiftTemplateId: found.id,
          dayOfWeek,
          requiredStaff: dayOfWeek === 0 || dayOfWeek === 6 ? 2 : 1,
        })),
        skipDuplicates: true,
      });
    } else {
      const created = await prisma.shiftTemplate.create({
        data: {
          storeId,
          name,
          startTime: def.startTime,
          endTime: def.endTime,
          durationHours,
          sortOrder: i,
          isActive: true,
        },
      });
      await prisma.staffingRule.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
            storeId,
            shiftTemplateId: created.id,
            dayOfWeek,
            requiredStaff: dayOfWeek === 0 || dayOfWeek === 6 ? 2 : 1,
        })),
        skipDuplicates: true,
      });
    }
  }

  const toDeactivate = existing.filter((s) => {
    const num = parseInt(s.name.replace("Ca ", ""), 10);
    return !isNaN(num) && num > shiftsPerDay;
  });

  if (toDeactivate.length > 0) {
    await prisma.shiftTemplate.updateMany({
      where: { id: { in: toDeactivate.map((shift) => shift.id) } },
      data: { isActive: false },
    });
  }

  const shifts = await prisma.shiftTemplate.findMany({
    where: { storeId, isActive: true },
    select: {
      id: true,
      storeId: true,
      name: true,
      startTime: true,
      endTime: true,
      durationHours: true,
      sortOrder: true,
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    success: true,
    shiftsPerDay,
    shifts,
    message: `Đã cấu hình ${shiftsPerDay} ca/ngày cho cửa hàng`,
  });
}
