import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER"], { module: "products", action: "VIEW" });
  if (error || !companyId) return error;

  try {
    const manufacturers = await prisma.manufacturer.findMany({
      where: { companyId },
      orderBy: { code: "asc" },
    });

    return NextResponse.json(manufacturers);
  } catch (err: any) {
    return NextResponse.json({ error: "Lỗi tải danh sách nhà sản xuất: " + err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN"], { module: "products", action: "EDIT" });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { name, code, address, phone, taxId, country } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Tên nhà sản xuất không được để trống" }, { status: 400 });
    }

    // Auto-generate random 3-digit code if not provided, or pad user code to 3 digits
    let finalCode = (code || "").trim();
    if (finalCode) {
      finalCode = finalCode.padStart(3, "0").slice(-3);
    } else {
      const existing = await prisma.manufacturer.findMany({
        where: { companyId },
        select: { code: true },
      });
      const existingCodes = new Set(existing.map((m) => m.code));

      // Generate random unique 3-digit code
      let attempts = 0;
      let generatedCode = "001";
      while (attempts < 1000) {
        const rand = Math.floor(Math.random() * 1000);
        generatedCode = String(rand).padStart(3, "0");
        if (!existingCodes.has(generatedCode)) {
          break;
        }
        attempts++;
      }
      finalCode = generatedCode;
    }

    const manufacturer = await prisma.manufacturer.create({
      data: {
        companyId,
        code: finalCode,
        name: name.trim(),
        address: address ? address.trim() : null,
        phone: phone ? phone.trim() : null,
        taxId: taxId ? taxId.trim() : null,
        country: country ? country.trim() : "Việt Nam",
      },
    });

    return NextResponse.json(manufacturer);
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Tên hoặc mã nhà sản xuất đã tồn tại" }, { status: 400 });
    }
    return NextResponse.json({ error: "Lỗi tạo nhà sản xuất: " + err.message }, { status: 500 });
  }
}
