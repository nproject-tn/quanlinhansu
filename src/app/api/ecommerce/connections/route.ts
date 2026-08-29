import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/ecommerce/connections - List all connected platforms
export async function GET(_request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], {
    module: "revenue",
    action: "VIEW",
  });
  if (error || !companyId) return error;

  try {
    const connections = await prisma.ecommerceConnection.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(connections);
  } catch (err: any) {
    console.error("GET /api/ecommerce/connections error:", err);
    return NextResponse.json({ error: "Lỗi tải kết nối sàn TMĐT: " + err.message }, { status: 500 });
  }
}

// POST /api/ecommerce/connections - Connect a new store / platform
export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], {
    module: "revenue",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { platform, shopId, shopName, accessToken, autoSyncStock, autoSyncOrders } = body;

    if (!platform || !shopId || !shopName) {
      return NextResponse.json({ error: "Thiếu thông tin sàn TMĐT hoặc Shop ID" }, { status: 400 });
    }

    const connection = await prisma.ecommerceConnection.upsert({
      where: {
        companyId_platform_shopId: {
          companyId,
          platform,
          shopId: shopId.trim(),
        },
      },
      create: {
        companyId,
        platform,
        shopId: shopId.trim(),
        shopName: shopName.trim(),
        accessToken: accessToken || null,
        autoSyncStock: autoSyncStock ?? true,
        autoSyncOrders: autoSyncOrders ?? true,
        isActive: true,
      },
      update: {
        shopName: shopName.trim(),
        accessToken: accessToken || undefined,
        autoSyncStock: autoSyncStock !== undefined ? autoSyncStock : true,
        autoSyncOrders: autoSyncOrders !== undefined ? autoSyncOrders : true,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, connection });
  } catch (err: any) {
    console.error("POST /api/ecommerce/connections error:", err);
    return NextResponse.json({ error: "Lỗi lưu kết nối sàn TMĐT: " + err.message }, { status: 500 });
  }
}
