import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import type { FactoryOrderStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER"], {
    module: "products",
    action: "VIEW",
  });
  if (error || !companyId) return error;

  try {
    const order = await prisma.factoryOrder.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        manufacturer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn đặt NSX" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi tải chi tiết đơn đặt NSX: " + err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], {
    module: "products",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const {
      batchCode,
      manufacturerId,
      manufacturerName,
      productName,
      sku,
      colorName,
      sizeName,
      orderQuantity,
      qcPassedQuantity,
      qcFailedQuantity,
      orderDate,
      expectedDate,
      receivedDate,
      qcNotes,
      failReasonNotes,
      status,
      batchLabelsPrinted,
      items,
      failedPo, // Optional split defect PO created during QC return
    } = body;

    // 1. Verify existence
    const existing = await prisma.factoryOrder.findFirst({
      where: { id, companyId },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy đơn đặt NSX" }, { status: 404 });
    }

    // 2. Update the main order
    const updatedOrder = await prisma.factoryOrder.update({
      where: { id },
      data: {
        ...(batchCode !== undefined && { batchCode }),
        ...(manufacturerId !== undefined && { manufacturerId }),
        ...(manufacturerName !== undefined && { manufacturerName }),
        ...(productName !== undefined && { productName }),
        ...(sku !== undefined && { sku }),
        ...(colorName !== undefined && { colorName }),
        ...(sizeName !== undefined && { sizeName }),
        ...(orderQuantity !== undefined && { orderQuantity: Number(orderQuantity) }),
        ...(qcPassedQuantity !== undefined && { qcPassedQuantity: Number(qcPassedQuantity) }),
        ...(qcFailedQuantity !== undefined && { qcFailedQuantity: Number(qcFailedQuantity) }),
        ...(orderDate !== undefined && { orderDate }),
        ...(expectedDate !== undefined && { expectedDate }),
        ...(receivedDate !== undefined && { receivedDate }),
        ...(qcNotes !== undefined && { qcNotes }),
        ...(failReasonNotes !== undefined && { failReasonNotes }),
        ...(status !== undefined && { status: status as FactoryOrderStatus }),
        ...(batchLabelsPrinted !== undefined && { batchLabelsPrinted: Boolean(batchLabelsPrinted) }),
      },
    });

    // 3. Update items if provided
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        if (it.id && !it.id.startsWith("new-") && !it.id.startsWith("item-")) {
          // Check if item exists in existing items
          const exists = existing.items.some((ei) => ei.id === it.id);
          if (exists) {
            await prisma.factoryOrderItem.update({
              where: { id: it.id },
              data: {
                ...(it.orderQuantity !== undefined && { orderQuantity: Number(it.orderQuantity) }),
                ...(it.qcPassedQuantity !== undefined && { qcPassedQuantity: Number(it.qcPassedQuantity) }),
                ...(it.qcFailedQuantity !== undefined && { qcFailedQuantity: Number(it.qcFailedQuantity) }),
              },
            });
          }
        }
      }
    }

    // 4. If a defect split PO was generated (e.g. during partial return), create it scoped to this company
    let createdFailedPo = null;
    if (failedPo && failedPo.code) {
      createdFailedPo = await prisma.factoryOrder.create({
        data: {
          companyId,
          code: failedPo.code,
          batchCode: failedPo.batchCode || failedPo.code,
          manufacturerId: failedPo.manufacturerId || existing.manufacturerId,
          manufacturerName: failedPo.manufacturerName || existing.manufacturerName,
          productId: failedPo.productId || existing.productId,
          productName: failedPo.productName || existing.productName,
          sku: failedPo.sku || existing.sku,
          colorName: failedPo.colorName || existing.colorName,
          sizeName: failedPo.sizeName || existing.sizeName,
          orderQuantity: Number(failedPo.orderQuantity) || 0,
          qcPassedQuantity: 0,
          qcFailedQuantity: Number(failedPo.qcFailedQuantity) || Number(failedPo.orderQuantity) || 0,
          orderDate: failedPo.orderDate || existing.orderDate,
          expectedDate: failedPo.expectedDate || existing.expectedDate,
          qcNotes: failedPo.qcNotes || null,
          failReasonNotes: failedPo.failReasonNotes || null,
          status: "IN_PRODUCTION",
          batchLabelsPrinted: false,
          items: {
            create: (failedPo.items || []).map((fi: any) => ({
              companyId,
              productId: fi.productId || null,
              productName: fi.productName || "",
              sku: fi.sku || "",
              colorName: fi.colorName || null,
              sizeName: fi.sizeName || null,
              orderQuantity: Number(fi.orderQuantity) || 0,
              qcPassedQuantity: 0,
              qcFailedQuantity: Number(fi.qcFailedQuantity) || Number(fi.orderQuantity) || 0,
            })),
          },
        },
        include: { items: true },
      });
    }

    const fullOrder = await prisma.factoryOrder.findUnique({
      where: { id },
      include: { items: true, manufacturer: true },
    });

    return NextResponse.json({
      order: fullOrder,
      failedPo: createdFailedPo,
      message: "Cập nhật đơn đặt NSX thành công",
    });
  } catch (err: any) {
    console.error("PATCH /api/factory-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Lỗi cập nhật đơn đặt NSX: " + err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], {
    module: "products",
    action: "DELETE",
  });
  if (error || !companyId) return error;

  try {
    const existing = await prisma.factoryOrder.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy đơn đặt NSX" }, { status: 404 });
    }

    await prisma.factoryOrder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Đã xoá đơn đặt NSX" });
  } catch (err: any) {
    console.error("DELETE /api/factory-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Lỗi xoá đơn đặt NSX: " + err.message },
      { status: 500 }
    );
  }
}
