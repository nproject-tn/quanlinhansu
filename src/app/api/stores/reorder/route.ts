import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "stores", action: "EDIT" });
  if (error) return error;

  try {
    const { storeIds } = await request.json();

    if (!Array.isArray(storeIds)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    // Verify all stores belong to the company
    const stores = await prisma.store.findMany({
      where: {
        id: { in: storeIds },
        companyId,
      },
    });

    if (stores.length !== storeIds.length) {
      return NextResponse.json({ error: "Some stores not found or access denied" }, { status: 403 });
    }

    // Update sortOrder for each store in a transaction
    await prisma.$transaction(
      storeIds.map((storeId, index) =>
        prisma.store.update({
          where: { id: storeId },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Reorder stores error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
