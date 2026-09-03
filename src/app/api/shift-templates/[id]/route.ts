import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { shiftTemplateSchema } from "@/lib/validations";
import { calcDurationHours, getShiftContainmentError } from "@/lib/shift-utils";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { error, companyId, user } = await requireAuth(["OWNER"], { module: "shift_config", action: "EDIT" });
  if (error || !companyId) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = shiftTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingTemplate = await prisma.shiftTemplate.findUnique({ where: { id, companyId } });
  if (!existingTemplate) {
    return NextResponse.json({ error: "Ca không tồn tại hoặc không có quyền truy cập" }, { status: 404 });
  }

  // Kiểm tra tên ca có bị trùng với các ca ĐANG HOẠT ĐỘNG khác không
  const existingActiveShift = await prisma.shiftTemplate.findFirst({
    where: {
      storeId: parsed.data.storeId,
      companyId,
      name: parsed.data.name,
      isActive: true,
      id: { not: id }, // Bỏ qua chính ca đang cập nhật
    },
  });

  if (existingActiveShift) {
    return NextResponse.json(
      { error: "Tên ca này đã tồn tại, vui lòng chọn tên khác." },
      { status: 400 }
    );
  }

  // Kiểm tra khung giờ ca có bị trùng hệt hoặc nằm lọt lòng trong ca ĐANG HOẠT ĐỘNG khác không
  const activeStoreShifts = await prisma.shiftTemplate.findMany({
    where: {
      companyId,
      storeId: parsed.data.storeId,
      isActive: true,
      id: { not: id }, // Bỏ qua chính ca đang cập nhật
    },
    select: { id: true, name: true, startTime: true, endTime: true },
  });

  for (const existing of activeStoreShifts) {
    const errorMsg = getShiftContainmentError(
      { startTime: parsed.data.startTime, endTime: parsed.data.endTime },
      existing
    );
    if (errorMsg) {
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
  }

  const durationHours = calcDurationHours(parsed.data.startTime, parsed.data.endTime);

  const template = await prisma.shiftTemplate.update({
    where: { id },
    data: { ...parsed.data, durationHours },
  });

  const { syncStoreShifts } = await import("@/lib/api-shift-utils");
  await syncStoreShifts(template.storeId);

  if (user) {
    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "UPDATE",
      module: "shift_config",
      targetType: "ShiftTemplate",
      targetId: template.id,
      targetName: template.name,
      description: `Đã cập nhật ca làm việc: ${template.name} (${template.startTime} - ${template.endTime})`,
      details: {
        name: template.name,
        startTime: template.startTime,
        endTime: template.endTime,
        durationHours: template.durationHours,
      },
    });
  }

  return NextResponse.json(template);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error, companyId, user } = await requireAuth(["OWNER"], { module: "shift_config", action: "EDIT" });
  if (error || !companyId) return error;

  const { id } = await params;

  const shiftTemplate = await prisma.shiftTemplate.findUnique({ where: { id, companyId } });
  if (!shiftTemplate) {
    return NextResponse.json({ error: "Ca không tồn tại hoặc không có quyền truy cập" }, { status: 404 });
  }

  const assignmentCount = await prisma.shiftAssignment.count({
    where: { shiftTemplateId: id },
  });

  if (assignmentCount > 0) {
    await prisma.shiftTemplate.update({
      where: { id },
      data: { 
        isActive: false,
        name: `${shiftTemplate.name} (đã xóa ${Date.now().toString().slice(-6)})`
      },
    });
    
    const { syncStoreShifts } = await import("@/lib/api-shift-utils");
    await syncStoreShifts(shiftTemplate.storeId);

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "DELETE",
        module: "shift_config",
        targetType: "ShiftTemplate",
        targetId: shiftTemplate.id,
        targetName: shiftTemplate.name,
        description: `Đã ẩn ca làm việc ${shiftTemplate.name} (đã có lịch xếp)`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Ca đã có lịch xếp — đã ẩn thay vì xóa hẳn",
      softDeleted: true,
    });
  }

  await prisma.staffingRule.deleteMany({ where: { shiftTemplateId: id } });
  await prisma.staffingOverride.deleteMany({ where: { shiftTemplateId: id } });
  await prisma.shiftTemplate.delete({ where: { id } });

  const { syncStoreShifts } = await import("@/lib/api-shift-utils");
  await syncStoreShifts(shiftTemplate.storeId);

  if (user) {
    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "DELETE",
      module: "shift_config",
      targetType: "ShiftTemplate",
      targetId: shiftTemplate.id,
      targetName: shiftTemplate.name,
      description: `Đã xoá vĩnh viễn ca làm việc ${shiftTemplate.name}`,
    });
  }

  return NextResponse.json({ success: true, message: "Đã xóa ca" });
}
