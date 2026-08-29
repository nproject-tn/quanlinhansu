import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { employeeSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";

export async function GET() {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], [
    { module: "employees", action: "VIEW" },
    { module: "revenue", action: "VIEW" },
    { module: "schedule", action: "VIEW" },
  ]);
  if (error) return error;

  const employees = await prisma.employee.findMany({
    where: { companyId, isArchived: false },
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
      deletedAt: true,
      stores: {
        where: {
          store: { isActive: true },
        },
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
  const { error, companyId } = await requireAuth(["OWNER"], { module: "employees", action: "EDIT" });
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
      companyId,
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

  const { session, user } = await requireAuth(["OWNER"], { module: "employees", action: "EDIT" });
  if (user) {
    const storeNames = employee.stores.map((s) => s.store.name);
    const empTypeLabel = employee.employmentType === "FULL_TIME" 
      ? "Toàn thời gian (Full-time)" 
      : employee.employmentType === "PART_TIME" 
      ? "Bán thời gian (Part-time)" 
      : "Thời vụ";

    const salTypeLabel = employee.salaryType === "HOURLY" 
      ? "Theo giờ (Hourly)" 
      : "Lương cố định (Fixed)";

    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "CREATE",
      module: "employees",
      targetType: "Employee",
      targetId: employee.id,
      targetName: employee.name,
      description: `Đã thêm nhân viên mới: ${employee.name} (${employee.position || "Nhân viên"}) tại ${storeNames.length > 0 ? storeNames.join(", ") : "chưa phân công cửa hàng"}`,
      details: {
        name: employee.name,
        position: employee.position || "Nhân viên",
        stores: storeNames.length > 0 ? storeNames.join(", ") : "Chưa phân công",
        employmentType: empTypeLabel,
        salaryType: salTypeLabel,
      },
    });
  }

  return NextResponse.json(employee, { status: 201 });
}
