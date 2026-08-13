import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// PUT: Update Manufacturer
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { name, code, address, phone, taxId, country } = body;

    const existingMfr = await prisma.manufacturer.findUnique({ where: { id, companyId } });
    if (!existingMfr) {
      return NextResponse.json({ error: "Không tìm thấy nhà sản xuất" }, { status: 404 });
    }

    let finalCode = (code || "").trim();
    if (finalCode) {
      finalCode = finalCode.padStart(3, "0").slice(-3);
    } else {
      finalCode = existingMfr.code;
    }

    const isCodeChanged = finalCode !== existingMfr.code;

    const updated = await prisma.manufacturer.update({
      where: { id, companyId },
      data: {
        name: name.trim(),
        code: finalCode,
        address: address !== undefined ? (address ? address.trim() : null) : undefined,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : undefined,
        taxId: taxId !== undefined ? (taxId ? taxId.trim() : null) : undefined,
        country: country !== undefined ? (country ? country.trim() : "Việt Nam") : undefined,
      },
    });

    let updatedBarcodesCount = 0;
    if (isCodeChanged) {
      const { generateEan8Barcode } = await import("@/lib/sku-engine");
      const linkedProducts = await prisma.product.findMany({
        where: { companyId, manufacturerId: id },
      });

      for (const prod of linkedProducts) {
        // Extract original 4-digit product code from barcode (digits 4 to 7)
        const pCode = prod.barcode.length >= 7 ? prod.barcode.slice(3, 7) : "0001";
        const newBarcode = generateEan8Barcode(finalCode, pCode);

        await prisma.product.update({
          where: { id: prod.id },
          data: {
            barcode: newBarcode,
            barcodeNeedsReprint: true,
          },
        });
        updatedBarcodesCount++;
      }
    }

    return NextResponse.json({
      ...updated,
      isCodeChanged,
      updatedBarcodesCount,
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Mã nhà sản xuất đã trùng lập" }, { status: 400 });
    }
    return NextResponse.json({ error: "Lỗi cập nhật NSX: " + err.message }, { status: 500 });
  }
}

// DELETE: Delete Manufacturer
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    // Unlink products associated with this manufacturer first, or delete
    await prisma.product.updateMany({
      where: { manufacturerId: id, companyId },
      data: { manufacturerId: null },
    });

    await prisma.manufacturer.delete({
      where: { id, companyId },
    });

    return NextResponse.json({ success: true, message: "Đã xoá nhà sản xuất thành công" });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi xoá nhà sản xuất: " + err.message }, { status: 500 });
  }
}
