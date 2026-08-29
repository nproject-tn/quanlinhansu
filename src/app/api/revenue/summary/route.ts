import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/revenue/summary - Analytics and KPI overview
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
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");

    const where: any = {
      companyId,
      orderStatus: { not: "CANCELLED" }, // Exclude cancelled orders from revenue
    };

    if (channel && channel !== "ALL") {
      where.channel = channel;
    }
    if (storeId && storeId !== "ALL") {
      where.storeId = storeId;
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

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        store: { select: { id: true, name: true } },
      },
      orderBy: { orderDate: "asc" },
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalDiscount = 0;
    let totalShipping = 0;
    const channelMap: Record<string, { count: number; revenue: number }> = {};
    const storeMap: Record<string, { name: string; count: number; revenue: number }> = {};
    const dailyMap: Record<string, { date: string; revenue: number; orderCount: number }> = {};

    for (const order of orders) {
      totalRevenue += order.finalAmount;
      totalDiscount += order.discountAmount;
      totalShipping += order.shippingFee;

      // Calculate cost
      for (const item of order.items) {
        totalCost += (item.costPrice || 0) * item.quantity;
      }

      // Channel breakdown
      const ch = order.channel;
      if (!channelMap[ch]) {
        channelMap[ch] = { count: 0, revenue: 0 };
      }
      channelMap[ch].count += 1;
      channelMap[ch].revenue += order.finalAmount;

      // Store breakdown
      const sId = order.storeId || "UNKNOWN";
      const sName = order.store?.name || "Kênh Online / Chung";
      if (!storeMap[sId]) {
        storeMap[sId] = { name: sName, count: 0, revenue: 0 };
      }
      storeMap[sId].count += 1;
      storeMap[sId].revenue += order.finalAmount;

      // Daily trend
      const dateKey = order.orderDate.toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, revenue: 0, orderCount: 0 };
      }
      dailyMap[dateKey].revenue += order.finalAmount;
      dailyMap[dateKey].orderCount += 1;
    }

    const totalOrders = orders.length;
    const grossProfit = totalRevenue - totalCost;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const profitMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

    // Convert channelMap to array with percentages
    const channelBreakdown = Object.entries(channelMap).map(([key, data]) => ({
      channel: key,
      count: data.count,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    const storeBreakdown = Object.entries(storeMap).map(([storeId, data]) => ({
      storeId,
      storeName: data.name,
      count: data.count,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalRevenue,
      totalCost,
      grossProfit,
      profitMargin,
      totalOrders,
      averageOrderValue,
      totalDiscount,
      totalShipping,
      channelBreakdown,
      storeBreakdown,
      dailyTrend,
    });
  } catch (err: any) {
    console.error("GET /api/revenue/summary error:", err);
    return NextResponse.json({ error: "Lỗi tính toán doanh thu: " + err.message }, { status: 500 });
  }
}
