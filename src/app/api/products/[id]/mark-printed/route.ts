import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST: Mark product barcode as printed (clears red warning badge)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    const updated = await prisma.product.update({
      where: { id, companyId },
      data: { barcodeNeedsReprint: false },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi cập nhật trạng thái in: " + err.message }, { status: 500 });
  }
}
