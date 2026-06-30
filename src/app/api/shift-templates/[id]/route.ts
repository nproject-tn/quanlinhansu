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

  return NextResponse.json(template);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;

  const assignmentCount = await prisma.shiftAssignment.count({
    where: { shiftTemplateId: id },
  });

  if (assignmentCount > 0) {
    await prisma.shiftTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({
      success: true,
      message: "Ca đã có lịch xếp — đã ẩn thay vì xóa hẳn",
      softDeleted: true,
    });
  }

  await prisma.staffingRule.deleteMany({ where: { shiftTemplateId: id } });
  await prisma.staffingOverride.deleteMany({ where: { shiftTemplateId: id } });
  await prisma.shiftTemplate.delete({ where: { id } });

  return NextResponse.json({ success: true, message: "Đã xóa ca" });
}
