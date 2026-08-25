import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import type { FactoryOrderStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER"], {
    module: "products",
    action: "VIEW",
  });
  if (error || !companyId) return error;

  try {
    const orders = await prisma.factoryOrder.findMany({
      where: { companyId },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: { createdAt: "asc" },
        },
        manufacturer: true,
        product: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (err: any) {
    console.error("GET /api/factory-orders error:", err);
    return NextResponse.json(
      { error: "Lỗi tải danh sách đơn đặt NSX: " + err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], {
    module: "products",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const {
      code,
      batchCode,
      manufacturerId,
      manufacturerName,
      productId,
      productName,
      sku,
      colorName,
      sizeName,
      orderQuantity,
      qcPassedQuantity = 0,
      qcFailedQuantity = 0,
      orderDate,
      expectedDate,
      receivedDate,
      qcNotes,
      failReasonNotes,
      status = "IN_PRODUCTION",
      batchLabelsPrinted = false,
      items = [],
    } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ error: "Mã PO không được để trống" }, { status: 400 });
    }
    if (!batchCode || !batchCode.trim()) {
      return NextResponse.json({ error: "Mã lô hàng không được để trống" }, { status: 400 });
    }

    const order = await prisma.factoryOrder.create({
      data: {
        companyId,
        code: code.trim(),
        batchCode: batchCode.trim(),
        manufacturerId: manufacturerId || null,
        manufacturerName: manufacturerName || "Chưa xác định",
        productId: productId || null,
        productName: productName || "",
        sku: sku || null,
        colorName: colorName || null,
        sizeName: sizeName || null,
        orderQuantity: Number(orderQuantity) || 0,
        qcPassedQuantity: Number(qcPassedQuantity) || 0,
        qcFailedQuantity: Number(qcFailedQuantity) || 0,
        orderDate: orderDate || new Date().toISOString().slice(0, 10),
        expectedDate: expectedDate || new Date().toISOString().slice(0, 10),
        receivedDate: receivedDate || null,
        qcNotes: qcNotes || null,
        failReasonNotes: failReasonNotes || null,
        status: status as FactoryOrderStatus,
        batchLabelsPrinted: Boolean(batchLabelsPrinted),
        items: {
          create: items.map((item: any) => ({
            companyId,
            productId: item.productId || null,
            productName: item.productName || "",
            sku: item.sku || "",
            colorName: item.colorName || null,
            sizeName: item.sizeName || null,
            orderQuantity: Number(item.orderQuantity) || 0,
            qcPassedQuantity: Number(item.qcPassedQuantity) || 0,
            qcFailedQuantity: Number(item.qcFailedQuantity) || 0,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        manufacturer: true,
      },
    });

    return NextResponse.json({ order, message: "Tạo đơn đặt NSX thành công" });
  } catch (err: any) {
    console.error("POST /api/factory-orders error:", err);
    return NextResponse.json(
      { error: "Lỗi tạo đơn đặt NSX: " + err.message },
      { status: 500 }
    );
  }
}
