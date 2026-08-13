import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const roleSchema = z.object({
  name: z.string().min(1, "Tên vai trò không được để trống"),
  permissions: z.any().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "settings", action: "EDIT" });
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const role = await prisma.companyRole.findUnique({
      where: { id }
    });

    if (!role || role.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy vai trò" }, { status: 404 });
    }

    // Check if name already exists for another role
    const existing = await prisma.companyRole.findFirst({
      where: {
        companyId,
        name: parsed.data.name,
        id: { not: id }
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Tên vai trò đã tồn tại" }, { status: 400 });
    }

    const updated = await prisma.companyRole.update({
      where: { id },
      data: {
        name: parsed.data.name,
        permissions: (parsed.data.permissions || {}) as any,
      }
    });

    return NextResponse.json({ success: true, role: updated });
  } catch (err: any) {
    console.error("PUT /api/settings/roles/[id] ERROR:", err);
    return NextResponse.json({ error: "Lỗi cập nhật vai trò: " + err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "settings", action: "EDIT" });
  if (error) return error;

  try {
    const { id } = await params;
    
    const role = await prisma.companyRole.findUnique({
      where: { id }
    });

    if (!role || role.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy vai trò" }, { status: 404 });
    }

    await prisma.companyRole.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/settings/roles/[id] ERROR:", err);
    return NextResponse.json({ error: "Lỗi xoá vai trò: " + err.message }, { status: 500 });
  }
}
