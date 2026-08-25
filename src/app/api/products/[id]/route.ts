import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "EDIT" });
  if (error || !companyId) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      brandName,
      manufacturerId,
      colorName,
      sizeName,
      unit,
      costPrice,
      sellingPrice,
      imageUrl,
      description,
    } = body;

    const existing = await prisma.product.findUnique({
      where: { id, companyId },
      include: { category: true, subcategory: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    }

    const { getColorCode, getSizeCode, generateSku, generateEan8Barcode } = await import("@/lib/sku-engine");

    const newColorName = colorName !== undefined ? (colorName ? colorName.trim() : null) : existing.colorName;
    const newSizeName = sizeName !== undefined ? (sizeName ? sizeName.trim() : null) : existing.sizeName;

    const colorCode = getColorCode(newColorName || "");
    const sizeCode = getSizeCode(newSizeName || "");

    const newSku = generateSku(
      existing.category.codeLetter,
      existing.subcategory.codeLetter,
      existing.itemCode,
      colorCode,
      sizeCode
    );

    let newBarcode = existing.barcode;
    let needsReprint = existing.barcodeNeedsReprint;

    const targetMfrId = manufacturerId !== undefined ? (manufacturerId || null) : existing.manufacturerId;
    if (targetMfrId !== existing.manufacturerId) {
      let mCode = "000";
      if (targetMfrId) {
        const m = await prisma.manufacturer.findUnique({ where: { id: targetMfrId } });
        if (m) mCode = m.code;
      }
      const pCode = existing.barcode.length >= 7 ? existing.barcode.slice(3, 7) : "0001";
      newBarcode = generateEan8Barcode(mCode, pCode);
      needsReprint = true;
    }

    const updated = await prisma.product.update({
      where: { id, companyId },
      data: {
        name: name ? name.trim() : existing.name,
        brandName: brandName !== undefined ? (brandName ? brandName.trim() : null) : existing.brandName,
        brandCode: brandName !== undefined ? (brandName ? (await import("@/lib/sku-engine")).generateBrandCode(brandName).brandCode : null) : existing.brandCode,
        manufacturerId: targetMfrId,
        colorName: newColorName,
        colorCode,
        sizeName: newSizeName,
        sizeCode,
        sku: newSku,
        barcode: newBarcode,
        barcodeNeedsReprint: needsReprint,
        unit: unit ? unit.trim() : existing.unit,
        costPrice: costPrice !== undefined ? parseFloat(costPrice) : existing.costPrice,
        sellingPrice: sellingPrice !== undefined ? parseFloat(sellingPrice) : existing.sellingPrice,
        imageUrl: imageUrl !== undefined ? (imageUrl ? imageUrl.trim() : null) : existing.imageUrl,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
      },
      include: {
        category: true,
        subcategory: true,
        manufacturer: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi cập nhật sản phẩm: " + err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "DELETE" });
  if (error || !companyId) return error;

  const { id } = await params;

  try {
    const existing = await prisma.product.findUnique({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    }

    await prisma.factoryOrderItem.deleteMany({
      where: { companyId, productId: id },
    });

    await prisma.product.delete({
      where: { id, companyId },
    });

    return NextResponse.json({ success: true, message: "Đã xóa biến thể sản phẩm thành công" });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi xoá sản phẩm: " + err.message }, { status: 500 });
  }
}
