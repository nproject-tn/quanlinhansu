import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/customers - Search and list customers
export async function GET(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], {
    module: "revenue",
    action: "VIEW",
  });
  if (error || !companyId) return error;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";

    const where: any = { companyId };
    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 30,
    });

    return NextResponse.json(customers);
  } catch (err: any) {
    console.error("GET /api/customers error:", err);
    return NextResponse.json({ error: "Lỗi tải danh sách khách hàng: " + err.message }, { status: 500 });
  }
}

// POST /api/customers - Create/update customer
export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], {
    module: "revenue",
    action: "EDIT",
  });
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { name, phone, email, address } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Tên khách hàng không được để trống" }, { status: 400 });
    }

    let customer;
    if (phone && phone.trim()) {
      customer = await prisma.customer.upsert({
        where: {
          companyId_phone: {
            companyId,
            phone: phone.trim(),
          },
        },
        create: {
          companyId,
          name: name.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
          address: address?.trim() || null,
        },
        update: {
          name: name.trim(),
          email: email?.trim() || undefined,
          address: address?.trim() || undefined,
        },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          companyId,
          name: name.trim(),
          phone: null,
          email: email?.trim() || null,
          address: address?.trim() || null,
        },
      });
    }

    return NextResponse.json({ success: true, customer });
  } catch (err: any) {
    console.error("POST /api/customers error:", err);
    return NextResponse.json({ error: "Lỗi lưu thông tin khách hàng: " + err.message }, { status: 500 });
  }
}
