import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { employeeSchema } from "@/lib/validations";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      employmentType: true,
      position: true,
      salaryType: true,
      monthlySalary: true,
      hourlyRate: true,
      maxShiftsPerMonth: true,
      maxHoursPerMonth: true,
      isActive: true,
      stores: {
        select: {
          store: { select: { id: true, name: true } },
        },
      },
      user: { select: { id: true, email: true, role: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await request.json();
  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeIds, ...data } = parsed.data;

  const employee = await prisma.employee.create({
    data: {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      stores: {
        create: storeIds.map((storeId) => ({ storeId })),
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      employmentType: true,
      position: true,
      salaryType: true,
      monthlySalary: true,
      hourlyRate: true,
      maxShiftsPerMonth: true,
      maxHoursPerMonth: true,
      isActive: true,
      stores: {
        select: {
          store: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
