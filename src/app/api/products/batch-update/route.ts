import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getColorCode, getSizeCode, generateSku, generateEan8Barcode, generateBrandCode } from "@/lib/sku-engine";

export const dynamic = "force-dynamic";

// PUT: Batch Update all variants in a product line & add new colors/sizes
export async function PUT(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const {
      categoryId,
      subcategoryId,
      itemCode,
      colorCode,
      name,
      brandName,
      manufacturerId,
      unit,
      costPrice,
      sellingPrice,
      imageUrl,
      description,
      colorsInput,
      sizesInput,
    } = body;

    if (!categoryId || !subcategoryId || !itemCode) {
      return NextResponse.json({ error: "Thiếu thông tin định danh nhóm sản phẩm" }, { status: 400 });
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });

    if (!category || !subcategory) {
      return NextResponse.json({ error: "Loại hàng hoặc chủng loại không tồn tại" }, { status: 400 });
    }

    const updateData: any = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (brandName !== undefined) {
      const bObj = generateBrandCode(brandName);
      updateData.brandName = bObj.brandName || null;
      updateData.brandCode = bObj.brandCode || null;
    }
    if (unit && unit.trim()) updateData.unit = unit.trim();
    if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice) || 0;
    if (sellingPrice !== undefined) updateData.sellingPrice = parseFloat(sellingPrice) || 0;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl ? imageUrl.trim() : null;
    if (description !== undefined) updateData.description = description ? description.trim() : null;

    if (manufacturerId !== undefined) {
      updateData.manufacturerId = manufacturerId || null;
    }

    const targetWhere: any = {
      companyId,
      categoryId,
      subcategoryId,
      itemCode,
    };
    if (colorCode) {
      targetWhere.colorCode = colorCode;
    }

    // 1. Update existing variants
    const updateResult = await prisma.product.updateMany({
      where: targetWhere,
      data: updateData,
    });

    // Manufacturer code for barcodes
    let mCode = "000";
    if (manufacturerId) {
      const m = await prisma.manufacturer.findUnique({ where: { id: manufacturerId } });
      if (m) mCode = m.code;
    }

    // If manufacturer changed, recalculate barcodes for all existing variants
    if (manufacturerId !== undefined) {
      const productsToUpdate = await prisma.product.findMany({
        where: { companyId, categoryId, subcategoryId, itemCode },
      });

      for (const prod of productsToUpdate) {
        const pCode = prod.barcode.length >= 7 ? prod.barcode.slice(3, 7) : "0001";
        const newBarcode = generateEan8Barcode(mCode, pCode);
        await prisma.product.update({
          where: { id: prod.id },
          data: {
            barcode: newBarcode,
            barcodeNeedsReprint: true,
          },
        });
      }
    }

    // 2. Handle adding NEW colors and sizes dynamically
    let newCreatedCount = 0;
    if (colorsInput !== undefined || sizesInput !== undefined) {
      const existingVariants = await prisma.product.findMany({
        where: { companyId, categoryId, subcategoryId, itemCode },
      });

      const existingSet = new Set(
        existingVariants.map((v) => `${(v.colorName || "").trim().toLowerCase()}|${(v.sizeName || "").trim().toLowerCase()}`)
      );

      const parsedColors = colorsInput
        ? colorsInput
            .split(",")
            .map((c: string) => c.trim())
            .filter(Boolean)
        : Array.from(new Set(existingVariants.map((v) => v.colorName || "")));

      const parsedSizes = sizesInput
        ? sizesInput
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : Array.from(new Set(existingVariants.map((v) => v.sizeName || "")));

      const finalColors = parsedColors.length > 0 ? parsedColors : [""];
      const finalSizes = parsedSizes.length > 0 ? parsedSizes : [""];

      let currentTotalCount = await prisma.product.count({ where: { companyId } });
      const finalName = name && name.trim() ? name.trim() : existingVariants[0]?.name || "Sản phẩm";
      const finalUnit = unit && unit.trim() ? unit.trim() : existingVariants[0]?.unit || "Cái";
      const finalCostPrice = costPrice !== undefined ? (parseFloat(costPrice) || 0) : (existingVariants[0]?.costPrice || 0);
      const finalSellingPrice = sellingPrice !== undefined ? (parseFloat(sellingPrice) || 0) : (existingVariants[0]?.sellingPrice || 0);
      const finalImage = imageUrl !== undefined ? (imageUrl ? imageUrl.trim() : null) : existingVariants[0]?.imageUrl;
      const finalDesc = description !== undefined ? (description ? description.trim() : null) : existingVariants[0]?.description;
      const finalMfrId = manufacturerId !== undefined ? (manufacturerId || null) : existingVariants[0]?.manufacturerId;
      const bObj = generateBrandCode(brandName !== undefined ? brandName : existingVariants[0]?.brandName);

      for (const cName of finalColors) {
        for (const sName of finalSizes) {
          const key = `${cName.trim().toLowerCase()}|${sName.trim().toLowerCase()}`;
          if (!existingSet.has(key)) {
            currentTotalCount++;
            const productCode = String(currentTotalCount).padStart(4, "0");
            const colorCode = getColorCode(cName);
            const sizeCode = getSizeCode(sName);

            const sku = generateSku(category.codeLetter, subcategory.codeLetter, itemCode, colorCode, sizeCode);
            const barcode = generateEan8Barcode(mCode, productCode);

            await prisma.product.create({
              data: {
                companyId,
                categoryId,
                subcategoryId,
                manufacturerId: finalMfrId,
                name: finalName,
                brandName: bObj.brandName || null,
                brandCode: bObj.brandCode || null,
                itemCode,
                colorName: cName || null,
                colorCode,
                sizeName: sName || null,
                sizeCode,
                sku,
                barcode,
                unit: finalUnit,
                costPrice: finalCostPrice,
                sellingPrice: finalSellingPrice,
                imageUrl: finalImage,
                description: finalDesc,
              },
            });
            existingSet.add(key);
            newCreatedCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: updateResult.count,
      newCreatedCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi cập nhật dòng sản phẩm: " + err.message }, { status: 500 });
  }
}

// DELETE: Delete an entire product line or a specific color cluster
export async function DELETE(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "DELETE" });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { categoryId, subcategoryId, itemCode, colorCode } = body;

    if (!categoryId || !subcategoryId || !itemCode) {
      return NextResponse.json({ error: "Thiếu thông tin định danh nhóm sản phẩm" }, { status: 400 });
    }

    const whereClause: any = { companyId, categoryId, subcategoryId, itemCode };
    if (colorCode) {
      whereClause.colorCode = colorCode;
    }

    // Unlink or delete factory order items if any
    const productsToDelete = await prisma.product.findMany({
      where: whereClause,
      select: { id: true },
    });
    const productIds = productsToDelete.map((p) => p.id);

    if (productIds.length > 0) {
      await prisma.factoryOrderItem.deleteMany({
        where: { companyId, productId: { in: productIds } },
      });
    }

    const deleted = await prisma.product.deleteMany({
      where: whereClause,
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      message: `Đã xóa ${deleted.count} biến thể sản phẩm`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi xóa dòng sản phẩm: " + err.message }, { status: 500 });
  }
}
