import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const roleSchema = z.object({
  name: z.string().min(1, "Tên vai trò không được để trống"),
  permissions: z.any().optional(),
});

export async function GET(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "settings", action: "VIEW" });
  if (error) return error;

  try {
    const roles = await prisma.companyRole.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" }
    });
    return NextResponse.json(roles);
  } catch (err: any) {
    console.error("GET /api/settings/roles ERROR:", err);
    return NextResponse.json({ error: "Lỗi tải dữ liệu vai trò" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "settings", action: "EDIT" });
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Check if name already exists
    const existing = await prisma.companyRole.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: parsed.data.name,
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Tên vai trò đã tồn tại" }, { status: 400 });
    }

    const role = await prisma.companyRole.create({
      data: {
        companyId,
        name: parsed.data.name,
        permissions: (parsed.data.permissions || {}) as any,
      }
    });

    return NextResponse.json({ success: true, role });
  } catch (err: any) {
    console.error("POST /api/settings/roles ERROR:", err);
    return NextResponse.json({ error: "Lỗi tạo vai trò: " + err.message }, { status: 500 });
  }
}
