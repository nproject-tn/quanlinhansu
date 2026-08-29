import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { retryStoreMutationWithoutLogo } from "@/lib/store-logo-fallback";
import { storeSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const authCheck = await requireAuth(["OWNER"], { module: "store", action: "EDIT" });
  if (authCheck.error || !authCheck.companyId) return authCheck.error;

  const { companyId, user } = authCheck;
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
          where: { id, companyId },
          data: parsed.data,
        }),
      () =>
        prisma.store.update({
          where: { id, companyId },
          data: dataWithoutLogo,
        })
    );

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "UPDATE",
        module: "store",
        targetType: "Store",
        targetId: store.id,
        targetName: store.name,
        description: `Đã cập nhật thông tin cửa hàng: ${store.name}`,
        details: {
          name: store.name,
          address: store.address,
        },
      });
    }

    return NextResponse.json({ ...store, logoPendingMigration });
  } catch (updateError) {
    console.error("PUT /api/stores/[id] failed", updateError);
    return NextResponse.json({ error: "Không cập nhật được cửa hàng" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const authCheck = await requireAuth(["OWNER"], { module: "store", action: "DELETE" });
  if (authCheck.error || !authCheck.companyId) return authCheck.error;

  const { companyId, user } = authCheck;
  const { id } = await params;

  const existingStore = await prisma.store.findUnique({
    where: { id, companyId },
    select: { name: true }
  });

  const assignmentCount = await prisma.shiftAssignment.count({
    where: { storeId: id, companyId },
  });

  if (assignmentCount > 0) {
    await prisma.store.update({
      where: { id, companyId },
      data: { isActive: false },
    });

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "DELETE",
        module: "store",
        targetType: "Store",
        targetId: id,
        targetName: existingStore?.name || "Cửa hàng",
        description: `Đã ẩn/ngừng hoạt động cửa hàng: ${existingStore?.name || id} (Đã có lịch làm việc)`,
        details: {
          name: existingStore?.name,
          softDeleted: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Cửa hàng đã có lịch xếp — đã ẩn thay vì xóa hẳn",
      softDeleted: true,
    });
  }

  await prisma.store.delete({ where: { id, companyId } });

  if (user) {
    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "DELETE",
      module: "store",
      targetType: "Store",
      targetId: id,
      targetName: existingStore?.name || "Cửa hàng",
      description: `Đã xoá hoàn toàn cửa hàng: ${existingStore?.name || id}`,
      details: {
        name: existingStore?.name,
      },
    });
  }

  return NextResponse.json({ success: true, message: "Đã xóa cửa hàng" });
}
