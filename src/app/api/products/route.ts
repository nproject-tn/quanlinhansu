import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import {
  generateEan8Barcode,
  generateSku,
  getColorCode,
  getSizeCode,
  indexToLetter,
} from "@/lib/sku-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER"], { module: "products", action: "VIEW" });
  if (error || !companyId) return error;

  try {
    const [products, categories, manufacturers] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, isArchived: false },
        include: {
          category: true,
          subcategory: true,
          manufacturer: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.category.findMany({
        where: { companyId },
        include: { subcategories: true },
        orderBy: { name: "asc" },
      }),
      prisma.manufacturer.findMany({
        where: { companyId },
        orderBy: { code: "asc" },
      }),
    ]);

    return NextResponse.json({ products, categories, manufacturers });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi tải danh sách sản phẩm: " + err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const {
      name,
      brandName,
      categoryName,
      subcategoryName,
      manufacturerId,
      colorName,
      sizeName,
      unit,
      costPrice,
      sellingPrice,
      imageUrl,
      description,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Tên sản phẩm không được để trống" }, { status: 400 });
    }
    if (!categoryName || !categoryName.trim()) {
      return NextResponse.json({ error: "Loại hàng không được để trống" }, { status: 400 });
    }
    if (!subcategoryName || !subcategoryName.trim()) {
      return NextResponse.json({ error: "Chủng loại sản phẩm không được để trống" }, { status: 400 });
    }

    const catNameTrimmed = categoryName.trim();
    const subcatNameTrimmed = subcategoryName.trim();

    // 1. Find or create Category
    let category = await prisma.category.findUnique({
      where: { companyId_name: { companyId, name: catNameTrimmed } },
    });

    if (!category) {
      const catCount = await prisma.category.count({ where: { companyId } });
      const codeLetter = indexToLetter(catCount);
      const codeNumeric = String((catCount % 9) + 1);

      category = await prisma.category.create({
        data: {
          companyId,
          name: catNameTrimmed,
          codeLetter,
          codeNumeric,
        },
      });
    }

    // 2. Find or create Subcategory
    let subcategory = await prisma.subcategory.findUnique({
      where: { categoryId_name: { categoryId: category.id, name: subcatNameTrimmed } },
    });

    if (!subcategory) {
      const subcatCount = await prisma.subcategory.count({ where: { categoryId: category.id } });
      const codeLetter = indexToLetter(subcatCount);
      const codeNumeric = String((subcatCount % 9) + 1);

      subcategory = await prisma.subcategory.create({
        data: {
          companyId,
          categoryId: category.id,
          name: subcatNameTrimmed,
          codeLetter,
          codeNumeric,
        },
      });
    }

    // 3. Find Manufacturer
    let manufacturerCode = "000";
    let selectedManufacturerId = manufacturerId || null;

    if (selectedManufacturerId) {
      const m = await prisma.manufacturer.findUnique({
        where: { id: selectedManufacturerId },
      });
      if (m) {
        manufacturerCode = m.code;
      }
    }

    // 4. Parse Multi-variant Colors & Sizes
    const rawColors = (colorName || "").split(",").map((c: string) => c.trim()).filter(Boolean);
    const rawSizes = (sizeName || "").split(",").map((s: string) => s.trim()).filter(Boolean);

    const colors = rawColors.length > 0 ? rawColors : [""];
    const sizes = rawSizes.length > 0 ? rawSizes : [""];

    // Fetch all existing SKUs to calculate unique itemCode and avoid any collision
    const existingProducts = await prisma.product.findMany({
      where: { companyId },
      select: { sku: true },
    });
    const existingSkus = existingProducts.map((p) => p.sku).filter(Boolean);
    const { getUniqueItemCode } = await import("@/lib/sku-engine");
    const itemCode = getUniqueItemCode(existingSkus, category.codeLetter, subcategory.codeLetter);

    let currentTotalCount = await prisma.product.count({ where: { companyId } });
    const createdProducts = [];

    for (const cName of colors) {
      for (const sName of sizes) {
        currentTotalCount++;

        const productCode = String(currentTotalCount).padStart(4, "0");

        const colorCode = getColorCode(cName);
        const sizeCode = getSizeCode(sName);

        let finalItemCode = itemCode;
        let sku = generateSku(category.codeLetter, subcategory.codeLetter, finalItemCode, colorCode, sizeCode);

        // Safety guarantee against any potential SKU duplication
        let attempt = 0;
        while (existingSkus.includes(sku) && attempt < 100) {
          attempt++;
          const nextVal = (parseInt(finalItemCode, 10) || 1) + 1;
          finalItemCode = String(nextVal).padStart(4, "0");
          sku = generateSku(category.codeLetter, subcategory.codeLetter, finalItemCode, colorCode, sizeCode);
        }
        existingSkus.push(sku);

        const barcode = generateEan8Barcode(manufacturerCode, productCode);

        const { generateBrandCode } = await import("@/lib/sku-engine");
        const bObj = generateBrandCode(brandName);

        const product = await prisma.product.create({
          data: {
            companyId,
            categoryId: category.id,
            subcategoryId: subcategory.id,
            manufacturerId: selectedManufacturerId,
            name: name.trim(),
            brandName: bObj.brandName || null,
            brandCode: bObj.brandCode || null,
            itemCode,
            colorName: cName || null,
            colorCode,
            sizeName: sName || null,
            sizeCode,
            sku,
            barcode,
            unit: unit ? unit.trim() : "Cái",
            costPrice: parseFloat(costPrice) || 0,
            sellingPrice: parseFloat(sellingPrice) || 0,
            imageUrl: imageUrl ? imageUrl.trim() : null,
            description: description ? description.trim() : null,
          },
          include: {
            category: true,
            subcategory: true,
            manufacturer: true,
          },
        });

        createdProducts.push(product);
      }
    }

    return NextResponse.json({
      count: createdProducts.length,
      product: createdProducts[0],
      products: createdProducts,
      message: `Đã tạo ${createdProducts.length} biến thể sản phẩm thành công`,
    });
  } catch (err: any) {
    console.error("POST /api/products error:", err);
    return NextResponse.json({ error: "Lỗi tạo sản phẩm: " + err.message }, { status: 500 });
  }
}
