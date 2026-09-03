import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { employeeSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "employees", action: "VIEW" });
  if (error) return error;

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id, companyId },
    include: {
      stores: {
        where: { store: { isActive: true } },
        include: { store: true }
      }
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  return NextResponse.json(employee);
}

export async function PUT(request: Request, { params }: Params) {
  const { error, companyId, user } = await requireAuth(["OWNER"], { module: "employees", action: "EDIT" });
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  if (body.restore) {
    const employee = await prisma.employee.update({
      where: { id, companyId },
      data: { deletedAt: null, isActive: true, isArchived: false },
      include: {
        stores: {
          where: { store: { isActive: true } },
          include: { store: true }
        }
      },
    });

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "UPDATE",
        module: "employees",
        targetType: "Employee",
        targetId: employee.id,
        targetName: employee.name,
        description: `Đã khôi phục trạng thái hoạt động cho nhân viên ${employee.name}`,
      });
    }

    return NextResponse.json(employee);
  }

  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.employee.findUnique({
    where: { id, companyId },
    include: {
      stores: {
        where: { store: { isActive: true } },
        include: { store: true }
      }
    }
  });

  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  const { storeIds, storeMaxHours, ...data } = parsed.data;

  await prisma.employeeStore.deleteMany({ where: { employeeId: id, store: { companyId } } });

  const employee = await prisma.employee.update({
    where: { id, companyId },
    data: {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      stores: {
        create: storeIds.map((storeId) => ({
          storeId,
          maxHoursPerMonth: storeMaxHours?.[storeId] ?? null,
        })),
      },
    },
    include: {
      stores: {
        where: { store: { isActive: true } },
        include: { store: true },
      },
    },
  });

  if (user) {
    const oldStoreNames = existing.stores.map((s) => s.store.name);
    const newStoreNames = employee.stores.map((s) => s.store.name);

    const addedStores = newStoreNames.filter((name) => !oldStoreNames.includes(name));
    const removedStores = oldStoreNames.filter((name) => !newStoreNames.includes(name));

    const changes: string[] = [];
    const changeDetails: Record<string, any> = {
      name: employee.name,
    };

    if (existing.name !== employee.name) {
      changes.push(`Đổi họ tên: ${existing.name} ➔ ${employee.name}`);
      changeDetails.nameChange = `${existing.name} ➔ ${employee.name}`;
    }
    if (existing.position !== employee.position) {
      changes.push(`Đổi chức vụ: ${existing.position || "Trống"} ➔ ${employee.position || "Trống"}`);
      changeDetails.position = `${existing.position || "Trống"} ➔ ${employee.position || "Trống"}`;
    }
    if (existing.employmentType !== employee.employmentType) {
      const oldType = existing.employmentType === "FULL_TIME" ? "Toàn thời gian (Full-time)" : existing.employmentType === "PART_TIME" ? "Bán thời gian (Part-time)" : "Thời vụ";
      const newType = employee.employmentType === "FULL_TIME" ? "Toàn thời gian (Full-time)" : employee.employmentType === "PART_TIME" ? "Bán thời gian (Part-time)" : "Thời vụ";
      changes.push(`Đổi hình thức làm việc: ${oldType} ➔ ${newType}`);
      changeDetails.employmentType = `${oldType} ➔ ${newType}`;
    }
    if (existing.salaryType !== employee.salaryType) {
      const oldSal = existing.salaryType === "HOURLY" ? "Theo giờ (Hourly)" : "Lương cố định (Fixed)";
      const newSal = employee.salaryType === "HOURLY" ? "Theo giờ (Hourly)" : "Lương cố định (Fixed)";
      changes.push(`Đổi hình thức lương: ${oldSal} ➔ ${newSal}`);
      changeDetails.salaryType = `${oldSal} ➔ ${newSal}`;
    }
    if (existing.phone !== employee.phone && (existing.phone || employee.phone)) {
      changes.push(`Đổi SĐT: ${existing.phone || "Trống"} ➔ ${employee.phone || "Trống"}`);
      changeDetails.phone = `${existing.phone || "Trống"} ➔ ${employee.phone || "Trống"}`;
    }
    if (existing.email !== employee.email && (existing.email || employee.email)) {
      changes.push(`Đổi Email: ${existing.email || "Trống"} ➔ ${employee.email || "Trống"}`);
      changeDetails.email = `${existing.email || "Trống"} ➔ ${employee.email || "Trống"}`;
    }

    if (addedStores.length > 0 && removedStores.length === 0) {
      changes.push(`Phân công thêm cửa hàng: ${addedStores.join(", ")}`);
      changeDetails.addedStores = addedStores.join(", ");
    } else if (removedStores.length > 0 && addedStores.length === 0) {
      changes.push(`Gỡ phụ trách tại cửa hàng: ${removedStores.join(", ")}`);
      changeDetails.removedStores = removedStores.join(", ");
    } else if (addedStores.length > 0 && removedStores.length > 0) {
      changes.push(`Gỡ phụ trách: ${removedStores.join(", ")} • Phân công thêm: ${addedStores.join(", ")}`);
      changeDetails.removedStores = removedStores.join(", ");
      changeDetails.addedStores = addedStores.join(", ");
    }

    // Check store hours changes
    const storeHoursChanged: string[] = [];
    for (const s of employee.stores) {
      const oldStore = existing.stores.find((es) => es.storeId === s.storeId);
      const oldHours = oldStore?.maxHoursPerMonth ?? null;
      const newHours = s.maxHoursPerMonth ?? null;
      if (oldHours !== newHours) {
        if (newHours !== null) {
          storeHoursChanged.push(`${s.store.name}: ${newHours}h`);
        } else {
          storeHoursChanged.push(`${s.store.name}: Bỏ định mức giờ`);
        }
      }
    }

    if (storeHoursChanged.length > 0) {
      changes.push(`Định mức giờ theo cửa hàng: ${storeHoursChanged.join(", ")}`);
      changeDetails.storeHoursChanges = storeHoursChanged.join(" • ");
    }

    const currentStoreDescriptions = employee.stores.map((s) =>
      s.maxHoursPerMonth ? `${s.store.name} (${s.maxHoursPerMonth}h)` : s.store.name
    );

    if (addedStores.length > 0 || removedStores.length > 0 || storeHoursChanged.length > 0) {
      changeDetails.currentStores = currentStoreDescriptions.length > 0 
        ? currentStoreDescriptions.join(", ") 
        : "Không có cửa hàng phụ trách";
    }

    const description = changes.length > 0
      ? `Đã cập nhật ${employee.name}: ${changes.join(" • ")}`
      : `Đã cập nhật thông tin nhân viên ${employee.name} (${employee.position || "Nhân viên"})`;

    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "UPDATE",
      module: "employees",
      targetType: "Employee",
      targetId: employee.id,
      targetName: employee.name,
      description,
      details: {
        ...changeDetails,
        changesSummary: changes.length > 0 ? changes : undefined,
      },
    });
  }

  return NextResponse.json(employee);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error, companyId, user } = await requireAuth(["OWNER"], { module: "employees", action: "DELETE" });
  if (error) return error;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id, companyId } });
  if (!employee) {
    return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  if (employee.deletedAt == null) {
    // Soft Delete and unassign future shifts (from tomorrow onwards in UTC+7)
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 7);
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    // Vacate future shifts
    await prisma.shiftAssignment.updateMany({
      where: {
        companyId,
        employeeId: id,
        date: { gte: tomorrow },
      },
      data: { employeeId: null },
    });

    await prisma.employee.update({
      where: { id, companyId },
      data: { deletedAt: new Date(), isActive: false },
    });

    if (employee.email) {
      await prisma.companyInvitation.deleteMany({
        where: { email: employee.email, companyId: employee.companyId }
      });
    }

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "DELETE",
        module: "employees",
        targetType: "Employee",
        targetId: employee.id,
        targetName: employee.name,
        description: `Đã chuyển nhân viên ${employee.name} sang trạng thái đã nghỉ việc`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Nhân viên đã được đưa vào danh sách đã nghỉ. Các ca làm từ ngày mai đã được làm trống.",
      softDeleted: true,
    });
  } else {
    // Archive (Permanently Hide from UI, but preserve history & past shift assignments)
    await prisma.user.updateMany({ where: { employeeId: id }, data: { employeeId: null } });
    await prisma.employee.update({ where: { id, companyId }, data: { isArchived: true, isActive: false } });
    
    if (employee.email) {
      await prisma.companyInvitation.deleteMany({
        where: { email: employee.email, companyId: employee.companyId }
      });
    }

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "DELETE",
        module: "employees",
        targetType: "Employee",
        targetId: employee.id,
        targetName: employee.name,
        description: `Đã lưu trữ / ẩn vĩnh viễn nhân viên ${employee.name}`,
      });
    }

    return NextResponse.json({ success: true, message: "Đã ẩn vĩnh viễn nhân viên khỏi danh sách nhưng vẫn lưu trữ lịch sử ca làm" });
  }
}
