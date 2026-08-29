import { prisma } from "@/lib/prisma";
import type { OrderChannel, OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

export type CreateOrderItemInput = {
  productId?: string;
  sku: string;
  productName: string;
  unitPrice: number;
  costPrice?: number;
  quantity: number;
  discount?: number;
};

export type CreateOrderInput = {
  companyId: string;
  code?: string;
  orderDate?: Date;
  channel?: OrderChannel;
  storeId?: string;
  employeeId?: string;
  
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  
  discountAmount?: number;
  shippingFee?: number;
  
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  orderStatus?: OrderStatus;
  
  externalOrderId?: string;
  externalTrackingCode?: string;
  note?: string;
  
  items: CreateOrderItemInput[];
};

/**
 * Generate unique order code: DH-YYYYMMDD-XXXX
 */
export async function generateOrderCode(companyId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const prefix = `DH-${dateStr}-`;

  const lastOrder = await prisma.order.findFirst({
    where: {
      companyId,
      code: { startsWith: prefix },
    },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });

  let nextSeq = 1;
  if (lastOrder && lastOrder.code.startsWith(prefix)) {
    const seqStr = lastOrder.code.replace(prefix, "");
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, "0")}`;
}

/**
 * Create an order and automatically adjust inventory and customer metrics
 */
export async function createOrder(input: CreateOrderInput) {
  const {
    companyId,
    orderDate = new Date(),
    channel = "POS_STORE",
    storeId,
    employeeId,
    customerId,
    customerName,
    customerPhone,
    customerAddress,
    discountAmount = 0,
    shippingFee = 0,
    paymentStatus = "PAID",
    paymentMethod = "CASH",
    orderStatus = "DELIVERED",
    externalOrderId,
    externalTrackingCode,
    note,
    items,
  } = input;

  const code = input.code || (await generateOrderCode(companyId));

  // Calculate totals
  let totalAmount = 0;
  const processedItems = items.map((item) => {
    const itemDiscount = item.discount || 0;
    const itemTotal = item.unitPrice * item.quantity - itemDiscount;
    totalAmount += item.unitPrice * item.quantity;

    return {
      companyId,
      productId: item.productId || null,
      sku: item.sku,
      productName: item.productName,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice || 0,
      quantity: item.quantity,
      discount: itemDiscount,
      totalPrice: itemTotal,
    };
  });

  const finalAmount = Math.max(0, totalAmount - discountAmount + shippingFee);

  // Execute in transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Manage Customer record if phone is provided
    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId && customerPhone && customerPhone.trim()) {
      const cleanPhone = customerPhone.trim();
      let existingCustomer = await tx.customer.findUnique({
        where: {
          companyId_phone: {
            companyId,
            phone: cleanPhone,
          },
        },
      });

      if (!existingCustomer) {
        existingCustomer = await tx.customer.create({
          data: {
            companyId,
            name: customerName || "Khách lẻ",
            phone: cleanPhone,
            address: customerAddress || null,
            totalOrders: 1,
            totalSpent: finalAmount,
          },
        });
      } else {
        await tx.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name: customerName || existingCustomer.name,
            address: customerAddress || existingCustomer.address,
            totalOrders: { increment: 1 },
            totalSpent: { increment: finalAmount },
          },
        });
      }
      resolvedCustomerId = existingCustomer.id;
    } else if (resolvedCustomerId) {
      await tx.customer.update({
        where: { id: resolvedCustomerId },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: finalAmount },
        },
      });
    }

    // 2. Create Order & Items
    const order = await tx.order.create({
      data: {
        companyId,
        code,
        orderDate,
        channel,
        storeId: storeId || null,
        employeeId: employeeId || null,
        customerId: resolvedCustomerId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerAddress: customerAddress || null,
        totalAmount,
        discountAmount,
        shippingFee,
        finalAmount,
        paymentStatus,
        paymentMethod,
        orderStatus,
        externalOrderId: externalOrderId || null,
        externalTrackingCode: externalTrackingCode || null,
        note: note || null,
        items: {
          create: processedItems,
        },
      },
      include: {
        items: true,
        store: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        customer: true,
      },
    });

    // 3. Automatically Deduct Inventory Stock (if order is not CANCELLED)
    if (orderStatus !== "CANCELLED") {
      for (const item of items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { decrement: item.quantity },
            },
          }).catch((err) => {
            console.warn(`Could not update stock for product ${item.productId}:`, err);
          });
        } else if (item.sku) {
          // If productId not given directly, search by companyId + sku
          const product = await tx.product.findUnique({
            where: {
              companyId_sku: {
                companyId,
                sku: item.sku,
              },
            },
          });
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: {
                stockQuantity: { decrement: item.quantity },
              },
            });
          }
        }
      }
    }

    return order;
  });
}

/**
 * Cancel an order and restore inventory stock
 */
export async function cancelOrder(companyId: string, orderId: string) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.companyId !== companyId) {
      throw new Error("Không tìm thấy đơn hàng");
    }

    if (order.orderStatus === "CANCELLED") {
      return order;
    }

    // 1. Restore inventory
    for (const item of order.items) {
      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantity },
          },
        }).catch((err) => console.warn("Stock restore error:", err));
      }
    }

    // 2. Adjust customer totalSpent if applicable
    if (order.customerId) {
      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          totalOrders: { decrement: 1 },
          totalSpent: { decrement: order.finalAmount },
        },
      }).catch((err) => console.warn("Customer stat adjust error:", err));
    }

    // 3. Update order status
    return await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: "CANCELLED",
        paymentStatus: order.paymentStatus === "PAID" ? "REFUNDED" : "UNPAID",
      },
      include: {
        items: true,
      },
    });
  });
}
