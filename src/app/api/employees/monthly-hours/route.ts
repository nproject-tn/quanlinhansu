import { format } from "date-fns";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getDateRange, calculateTotalMonthlyHours } from "@/lib/schedule-engine";
import { parseDateOnly } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");
  const { start, end } = getDateRange("month", parseDateOnly(`${month}-01`));

  const [employees, assignments] = await Promise.all([
    prisma.employee.findMany({
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
        date: true,
        shiftTemplate: {
          select: {
            durationHours: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    }),
  ]);

  const totals = new Map<string, { actualHours: number; actualShifts: number }>();

  const assignmentsByEmployee = new Map<string, any[]>();
  for (const assignment of assignments) {
    if (!assignment.employeeId) continue;
    if (!assignmentsByEmployee.has(assignment.employeeId)) {
      assignmentsByEmployee.set(assignment.employeeId, []);
    }
    assignmentsByEmployee.get(assignment.employeeId)!.push({
      date: assignment.date,
      shift: {
        startTime: assignment.shiftTemplate.startTime,
        endTime: assignment.shiftTemplate.endTime,
      }
    });
  }

  for (const assignment of assignments) {
    if (!assignment.employeeId) continue;

    const current = totals.get(assignment.employeeId) ?? {
      actualHours: 0,
      actualShifts: 0,
    };

    if (current.actualShifts === 0) {
      current.actualHours = calculateTotalMonthlyHours(assignmentsByEmployee.get(assignment.employeeId) || []);
    }
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
