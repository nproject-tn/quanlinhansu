import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { retryStoreMutationWithoutLogo } from "@/lib/store-logo-fallback";
import { storeSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = storeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { logoUrl: _logoUrl, ...dataWithoutLogo } = parsed.data;
    const { result: store, logoPendingMigration } = await retryStoreMutationWithoutLogo(
      Boolean(parsed.data.logoUrl),
      () =>
        prisma.store.update({
          where: { id },
          data: parsed.data,
        }),
      () =>
        prisma.store.update({
          where: { id },
          data: dataWithoutLogo,
        })
    );

    return NextResponse.json({ ...store, logoPendingMigration });
  } catch (updateError) {
    console.error("PUT /api/stores/[id] failed", updateError);
    return NextResponse.json({ error: "Không cập nhật được cửa hàng" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;

  const assignmentCount = await prisma.shiftAssignment.count({
    where: { storeId: id },
  });

  if (assignmentCount > 0) {
    await prisma.store.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({
      success: true,
      message: "Cửa hàng đã có lịch xếp — đã ẩn thay vì xóa hẳn",
      softDeleted: true,
    });
  }

  await prisma.store.delete({ where: { id } });

  return NextResponse.json({ success: true, message: "Đã xóa cửa hàng" });
}
