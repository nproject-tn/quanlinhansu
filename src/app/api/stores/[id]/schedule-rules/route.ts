import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    // Check permission to edit store config or schedule config
    const { error, companyId } = await requireAuth(["OWNER"], [
      { module: "store", action: "EDIT" },
      { module: "schedule", action: "EDIT" },
      { module: "shift_config", action: "EDIT" }
    ]);
    if (error || !companyId) return error;

    const body = await request.json();
    const { maxHoursPerDay, maxShiftsPerDay } = body;

    // Verify store belongs to company
    const store = await prisma.store.findFirst({
      where: { id: params.id, companyId }
    });

    if (!store) {
      return NextResponse.json({ error: "Không tìm thấy cửa hàng" }, { status: 404 });
    }

    const updatedStore = await prisma.store.update({
      where: { id: params.id },
      data: {
        maxHoursPerDay: maxHoursPerDay !== null ? Number(maxHoursPerDay) : null,
        maxShiftsPerDay: maxShiftsPerDay !== null ? Number(maxShiftsPerDay) : null,
      }
    });

    return NextResponse.json(updatedStore);
  } catch (error) {
    console.error("Error updating store schedule rules:", error);
    return NextResponse.json(
      { error: "Đã có lỗi xảy ra khi lưu cấu hình" },
      { status: 500 }
    );
  }
}
