import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { createOrder, type CreateOrderInput } from "@/lib/order-service";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

// GET /api/orders - Fetch orders with rich filtering
export async function GET(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], {
    module: "revenue",
    action: "VIEW",
  });
  if (error || !companyId) return error;

  try {
    const url = new URL(request.url);
    const channel = url.searchParams.get("channel");
    const storeId = url.searchParams.get("storeId");
    const orderStatus = url.searchParams.get("orderStatus");
    const paymentStatus = url.searchParams.get("paymentStatus");
    const search = url.searchParams.get("search");
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (channel && channel !== "ALL") {
      where.channel = channel;
    }
    if (storeId && storeId !== "ALL") {
      where.storeId = storeId;
    }
    if (orderStatus && orderStatus !== "ALL") {
      where.orderStatus = orderStatus;
    }
    if (paymentStatus && paymentStatus !== "ALL") {
      where.paymentStatus = paymentStatus;
    }

    if (fromDate || toDate) {
      where.orderDate = {};
      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        where.orderDate.gte = start;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.orderDate.lte = end;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { externalOrderId: { contains: q, mode: "insensitive" } },
        { externalTrackingCode: { contains: q, mode: "insensitive" } },
        { items: { some: { sku: { contains: q, mode: "insensitive" } } } },
        { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          store: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { orderDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "Lỗi tải danh sách đơn hàng: " + err.message }, { status: 500 });
  }
}

// POST /api/orders - Create new order
export async function POST(request: Request) {
  const { error, companyId, user } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], {
    module: "revenue",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  try {
    const body = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Đơn hàng phải có ít nhất 1 sản phẩm" }, { status: 400 });
    }

    const input: CreateOrderInput = {
      companyId,
      code: body.code,
      orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
      channel: body.channel || "POS_STORE",
      storeId: body.storeId,
      employeeId: body.employeeId || user.employeeId || null,
      customerId: body.customerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerAddress: body.customerAddress,
      discountAmount: Number(body.discountAmount) || 0,
      shippingFee: Number(body.shippingFee) || 0,
      paymentStatus: body.paymentStatus || "PAID",
      paymentMethod: body.paymentMethod || "CASH",
      orderStatus: body.orderStatus || "DELIVERED",
      externalOrderId: body.externalOrderId,
      externalTrackingCode: body.externalTrackingCode,
      note: body.note,
      items: body.items.map((it: any) => ({
        productId: it.productId,
        sku: it.sku,
        productName: it.productName || it.name,
        unitPrice: Number(it.unitPrice) || Number(it.sellingPrice) || 0,
        costPrice: Number(it.costPrice) || 0,
        quantity: Number(it.quantity) || 1,
        discount: Number(it.discount) || 0,
      })),
    };

    const order = await createOrder(input);

    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "CREATE",
      module: "revenue",
      targetType: "Order",
      targetId: order.id,
      targetName: order.code,
      description: `Đã tạo đơn hàng ${order.code} trị giá ${order.finalAmount.toLocaleString("vi-VN")} ₫`,
      details: {
        code: order.code,
        channel: order.channel,
        finalAmount: order.finalAmount,
        customerName: order.customerName,
        paymentMethod: order.paymentMethod,
        itemsCount: order.items?.length || 0,
      },
    });

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/orders error:", err);
    return NextResponse.json({ error: "Lỗi tạo đơn hàng: " + err.message }, { status: 500 });
  }
}
