import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER"], { module: "products", action: "VIEW" });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { selectedColumns = [], search = "", categoryId = "" } = body;

    const where: any = { companyId, isArchived: false };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        subcategory: true,
        manufacturer: true,
      },
      orderBy: { name: "asc" },
    });

    const columnsMap: Record<string, { label: string; getValue: (p: any) => string }> = {
      sku: { label: "Mã SKU", getValue: (p) => p.sku },
      barcode: { label: "Mã vạch (Barcode EAN-8)", getValue: (p) => p.barcode },
      name: { label: "Tên sản phẩm", getValue: (p) => p.name },
      category: { label: "Loại hàng", getValue: (p) => p.category?.name || "" },
      subcategory: { label: "Chủng loại", getValue: (p) => p.subcategory?.name || "" },
      manufacturer: { label: "Nhà sản xuất", getValue: (p) => p.manufacturer?.name || "" },
      manufacturerCode: { label: "Mã NSX", getValue: (p) => p.manufacturer?.code || "" },
      colorName: { label: "Màu sắc", getValue: (p) => p.colorName || "" },
      sizeName: { label: "Kích thước (Size)", getValue: (p) => p.sizeName || "" },
      unit: { label: "Đơn vị tính", getValue: (p) => p.unit },
      costPrice: { label: "Giá nhập (VND)", getValue: (p) => String(p.costPrice) },
      sellingPrice: { label: "Giá bán (VND)", getValue: (p) => String(p.sellingPrice) },
      description: { label: "Mô tả", getValue: (p) => p.description || "" },
    };

    const activeCols = selectedColumns.length > 0
      ? selectedColumns.filter((col: string) => columnsMap[col])
      : Object.keys(columnsMap);

    // Build CSV Headers
    const headers = activeCols.map((col: string) => `"${columnsMap[col].label}"`).join(",");

    // Build CSV Rows
    const rows = products.map((p) => {
      return activeCols
        .map((col: string) => {
          const val = columnsMap[col].getValue(p);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(",");
    });

    // Add UTF-8 BOM so Excel opens Vietnamese characters correctly
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="danh_sach_hang_hoa_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi xuất dữ liệu sản phẩm: " + err.message }, { status: 500 });
  }
}
