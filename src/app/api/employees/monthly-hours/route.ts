import { endOfMonth, format, parseISO } from "date-fns";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");
  const start = parseISO(`${month}-01`);
  const end = endOfMonth(start);

  const [employees, assignments] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        position: true,
        maxShiftsPerMonth: true,
        maxHoursPerMonth: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.shiftAssignment.findMany({
      where: {
        employeeId: { not: null },
        date: { gte: start, lte: end },
      },
      select: {
        employeeId: true,
        shiftTemplate: {
          select: {
            durationHours: true,
          },
        },
      },
    }),
  ]);

  const totals = new Map<string, { actualHours: number; actualShifts: number }>();

  for (const assignment of assignments) {
    if (!assignment.employeeId) continue;

    const current = totals.get(assignment.employeeId) ?? {
      actualHours: 0,
      actualShifts: 0,
    };

    current.actualHours += assignment.shiftTemplate.durationHours;
    current.actualShifts += 1;
    totals.set(assignment.employeeId, current);
  }

  return NextResponse.json(
    employees.map((employee) => {
      const total = totals.get(employee.id) ?? { actualHours: 0, actualShifts: 0 };
      return {
        ...employee,
        month,
        actualHours: Math.round(total.actualHours * 10) / 10,
        actualShifts: total.actualShifts,
        hoursDelta: Math.round((total.actualHours - employee.maxHoursPerMonth) * 10) / 10,
        shiftsDelta: total.actualShifts - employee.maxShiftsPerMonth,
      };
    })
  );
}
