import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const { session, error, companyId } = await requireAuth(["OWNER", "ADMIN"]);
  if (error || !companyId) return error;

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, logo: true, isActive: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Không tìm thấy doanh nghiệp" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (dbError: any) {
    console.error("GET /api/settings/company error:", dbError);
    return NextResponse.json({ error: "Lỗi tải thông tin doanh nghiệp" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { session, error, companyId } = await requireAuth(["OWNER", "ADMIN"]);
  if (error || !companyId) return error;

  try {
    const body = await request.json();
    const { name, logo } = body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (logo !== undefined) dataToUpdate.logo = logo;

    const company = await prisma.company.update({
      where: { id: companyId },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, company });
  } catch (dbError: any) {
    console.error("PUT /api/settings/company error:", dbError);
    return NextResponse.json({ error: "Lỗi cập nhật doanh nghiệp" }, { status: 500 });
  }
}
