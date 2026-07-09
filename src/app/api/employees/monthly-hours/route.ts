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

  const [employees, assignments, faultsRaw, overtimesRaw] = await Promise.all([
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
    prisma.shiftFault.findMany({
      where: {
        assignment: { date: { gte: start, lte: end } }
      },
      select: {
        id: true,
        employeeId: true,
        note: true,
        evidenceUrl: true,
        createdAt: true,
        assignment: {
          select: {
            date: true,
            shiftTemplate: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.shiftOvertime.findMany({
      where: {
        date: { gte: start, lte: end }
      },
      select: {
        employeeId: true,
        hours: true,
      }
    }),
  ]);

  const totals = new Map<string, { actualHours: number; actualShifts: number; overtimeHours: number; faults: any[] }>();

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

  for (const employee of employees) {
    totals.set(employee.id, { actualHours: 0, actualShifts: 0, overtimeHours: 0, faults: [] });
  }

  for (const fault of faultsRaw) {
    if (totals.has(fault.employeeId)) {
      totals.get(fault.employeeId)!.faults.push({
        id: fault.id,
        note: fault.note,
        evidenceUrl: fault.evidenceUrl,
        date: fault.assignment.date,
        shiftName: fault.assignment.shiftTemplate.name,
        createdAt: fault.createdAt
      });
    }
  }

  for (const ot of overtimesRaw) {
    if (totals.has(ot.employeeId)) {
      totals.get(ot.employeeId)!.overtimeHours += ot.hours;
    }
  }

  for (const assignment of assignments) {
    if (!assignment.employeeId) continue;

    const current = totals.get(assignment.employeeId);
    if (!current) continue;

    if (current.actualShifts === 0) {
      current.actualHours = calculateTotalMonthlyHours(assignmentsByEmployee.get(assignment.employeeId) || []);
    }
    current.actualShifts += 1;
  }

  return NextResponse.json(
    employees.map((employee) => {
      const total = totals.get(employee.id)!;
      const totalHours = total.actualHours + total.overtimeHours;
      return {
        ...employee,
        month,
        actualHours: Math.round(total.actualHours * 10) / 10,
        overtimeHours: Math.round(total.overtimeHours * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        actualShifts: total.actualShifts,
        hoursDelta: Math.round((totalHours - employee.maxHoursPerMonth) * 10) / 10,
        shiftsDelta: total.actualShifts - employee.maxShiftsPerMonth,
        faults: total.faults,
        totalFaults: total.faults.length,
      };
    })
  );
}
