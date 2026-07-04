import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { shiftTemplateSchema } from "@/lib/validations";
import { calcDurationHours } from "@/lib/shift-utils";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = shiftTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const durationHours = calcDurationHours(parsed.data.startTime, parsed.data.endTime);

  const template = await prisma.shiftTemplate.update({
    where: { id },
    data: { ...parsed.data, durationHours },
  });

  const { syncStoreShifts } = await import("@/lib/api-shift-utils");
  await syncStoreShifts(template.storeId);

  return NextResponse.json(template);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;

  const shiftTemplate = await prisma.shiftTemplate.findUnique({ where: { id } });
  if (!shiftTemplate) {
    return NextResponse.json({ error: "Ca không tồn tại" }, { status: 404 });
  }

  const assignmentCount = await prisma.shiftAssignment.count({
    where: { shiftTemplateId: id },
  });

  if (assignmentCount > 0) {
    await prisma.shiftTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    
    const { syncStoreShifts } = await import("@/lib/api-shift-utils");
    await syncStoreShifts(shiftTemplate.storeId);

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

  return NextResponse.json({ success: true, message: "Đã xóa ca" });
}
