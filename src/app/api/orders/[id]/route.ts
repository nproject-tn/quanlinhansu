import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { cancelOrder } from "@/lib/order-service";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/orders/[id] - Fetch single order detail
export async function GET(_request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], {
    module: "revenue",
    action: "VIEW",
  });
  if (error || !companyId) return error;

  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, imageUrl: true, brandName: true, unit: true } },
          },
        },
        store: { select: { id: true, name: true, address: true } },
        employee: { select: { id: true, name: true, phone: true } },
        customer: true,
      },
    });

    if (!order || order.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (err: any) {
    console.error("GET /api/orders/[id] error:", err);
    return NextResponse.json({ error: "Lỗi tải chi tiết đơn hàng: " + err.message }, { status: 500 });
  }
}

// PUT /api/orders/[id] - Update order details or status
export async function PUT(request: Request, { params }: Params) {
  const { error, companyId, user } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], {
    module: "revenue",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.order.findUnique({
      where: { id },
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    // If changing to CANCELLED, use cancelOrder to restore stock
    if (body.orderStatus === "CANCELLED" && existing.orderStatus !== "CANCELLED") {
      const cancelled = await cancelOrder(companyId, id);
      return NextResponse.json({ success: true, order: cancelled });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        orderStatus: body.orderStatus !== undefined ? body.orderStatus : existing.orderStatus,
        paymentStatus: body.paymentStatus !== undefined ? body.paymentStatus : existing.paymentStatus,
        paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod,
        customerName: body.customerName !== undefined ? body.customerName : existing.customerName,
        customerPhone: body.customerPhone !== undefined ? body.customerPhone : existing.customerPhone,
        customerAddress: body.customerAddress !== undefined ? body.customerAddress : existing.customerAddress,
        externalTrackingCode: body.externalTrackingCode !== undefined ? body.externalTrackingCode : existing.externalTrackingCode,
        note: body.note !== undefined ? body.note : existing.note,
      },
      include: {
        items: true,
        store: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        customer: true,
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
        module: "revenue",
        targetType: "Order",
        targetId: updated.id,
        targetName: updated.code,
        description: `Đã cập nhật đơn hàng ${updated.code} (Trạng thái: ${updated.orderStatus})`,
        details: {
          code: updated.code,
          orderStatus: updated.orderStatus,
          paymentStatus: updated.paymentStatus,
          customerName: updated.customerName,
          finalAmount: updated.finalAmount,
        },
      });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (err: any) {
    console.error("PUT /api/orders/[id] error:", err);
    return NextResponse.json({ error: "Lỗi cập nhật đơn hàng: " + err.message }, { status: 500 });
  }
}

// DELETE /api/orders/[id] - Cancel/Delete order
export async function DELETE(_request: Request, { params }: Params) {
  const { error, companyId, user } = await requireAuth(["OWNER", "ADMIN"], {
    module: "revenue",
    action: "DELETE",
  });
  if (error || !companyId) return error;

  try {
    const { id } = await params;
    const cancelled = await cancelOrder(companyId, id);

    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "CANCEL",
      module: "revenue",
      targetType: "Order",
      targetId: cancelled.id,
      targetName: cancelled.code,
      description: `Đã huỷ đơn hàng ${cancelled.code} và hoàn lại tồn kho`,
      details: {
        code: cancelled.code,
        finalAmount: cancelled.finalAmount,
        customerName: cancelled.customerName,
      },
    });

    return NextResponse.json({ success: true, message: "Đã hủy đơn hàng và hoàn lại tồn kho", order: cancelled });
  } catch (err: any) {
    console.error("DELETE /api/orders/[id] error:", err);
    return NextResponse.json({ error: "Lỗi huỷ đơn hàng: " + err.message }, { status: 500 });
  }
}
