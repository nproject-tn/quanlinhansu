import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "settings", action: "VIEW" });
  if (error) return error;

  try {
    const members = await prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true,
          }
        },
        companyRole: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const invitations = await prisma.companyInvitation.findMany({
      where: { companyId, status: "PENDING" },
      orderBy: { createdAt: "asc" }
    });

    const roles = await prisma.companyRole.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ members, invitations, roles });
  } catch (err) {
    return NextResponse.json({ error: "Lỗi tải dữ liệu thành viên" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "settings", action: "EDIT" });
  if (error) return error;

  try {
    const body = await request.json();
    const { memberId, permissions, role, companyRoleId } = body;

    // Verify member belongs to this company
    const member = await prisma.companyMember.findUnique({
      where: { id: memberId }
    });

    if (!member || member.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });
    }

    const updated = await prisma.companyMember.update({
      where: { id: memberId },
      data: {
        permissions: permissions !== undefined ? permissions : member.permissions,
        role: role || member.role,
        companyRoleId: companyRoleId !== undefined ? companyRoleId : member.companyRoleId,
      }
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (err: any) {
    console.error("PUT /api/settings/members ERROR:", err);
    return NextResponse.json({ error: "Lỗi cập nhật quyền: " + err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { session, error, companyId } = await requireAuth(["OWNER"]);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "Thiếu ID thành viên" }, { status: 400 });
    }

    // Verify member belongs to this company
    const member = await prisma.companyMember.findUnique({
      where: { id: memberId }
    });

    if (!member || member.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });
    }

    if (member.userId === session.user.id) {
      return NextResponse.json({ error: "Bạn không thể tự xoá chính mình khỏi doanh nghiệp. Vui lòng chuyển quyền chủ sở hữu cho người khác trước." }, { status: 400 });
    }

    await prisma.companyMember.delete({
      where: { id: memberId }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Lỗi khi xoá thành viên" }, { status: 500 });
  }
}
