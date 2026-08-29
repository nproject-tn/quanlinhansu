import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-logger";
import { summarizePermissionsInVietnamese } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authCheck = await requireAuth(["OWNER"], { module: "settings", action: "VIEW" });
  if (authCheck.error) return authCheck.error;

  const { companyId } = authCheck;

  try {
    const members = await prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        },
        companyRole: {
          select: {
            id: true,
            name: true,
            permissions: true,
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const invitations = await prisma.companyInvitation.findMany({
      where: { companyId, status: "PENDING" },
      include: {
        companyRole: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const roles = await prisma.companyRole.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" }
    });

    const pendingTransfer = await prisma.ownershipTransfer.findFirst({
      where: { companyId, status: "PENDING" },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ members, invitations, roles, pendingTransfer });
  } catch (err) {
    return NextResponse.json({ error: "Lỗi tải dữ liệu thành viên" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authCheck = await requireAuth(["OWNER"], { module: "settings", action: "EDIT" });
  if (authCheck.error) return authCheck.error;

  const { companyId, user } = authCheck;

  try {
    const body = await request.json();
    const { memberId, permissions, role, companyRoleId } = body;

    // Direct assignment of OWNER role is blocked (must use ownership transfer workflow)
    if (role === "OWNER") {
      return NextResponse.json({ 
        error: "Không thể gán quyền Chủ sở hữu trực tiếp. Vui lòng sử dụng tính năng Chuyển giao quyền Chủ sở hữu." 
      }, { status: 400 });
    }

    // Verify member belongs to this company
    const member = await prisma.companyMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!member || member.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });
    }

    // Protect OWNER member: non-owners cannot edit the owner
    if (member.role === "OWNER" && user.role !== "OWNER") {
      return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa tài khoản của Chủ sở hữu" }, { status: 403 });
    }

    const updated = await prisma.companyMember.update({
      where: { id: memberId },
      data: {
        permissions: permissions !== undefined ? permissions : member.permissions,
        role: role || member.role,
        companyRoleId: companyRoleId !== undefined ? companyRoleId : member.companyRoleId,
      }
    });

    let customRoleName: string | null = null;
    if (updated.companyRoleId) {
      const customRole = await prisma.companyRole.findUnique({
        where: { id: updated.companyRoleId },
        select: { name: true }
      });
      if (customRole) customRoleName = customRole.name;
    }

    const permSummary = summarizePermissionsInVietnamese(updated.permissions, updated.role, customRoleName);

    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "UPDATE",
      module: "settings",
      targetType: "CompanyMember",
      targetId: memberId,
      targetName: member.user?.name || member.user?.email || "Thành viên",
      description: `Đã cập nhật vai trò ${permSummary.roleTitle} cho ${member.user?.name || member.user?.email}: ${permSummary.moduleList.join(" • ")}`,
      details: {
        role: updated.role,
        roleTitle: permSummary.roleTitle,
        permissionsSummary: permSummary.moduleList,
        permissions: updated.permissions,
      },
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (err: any) {
    console.error("PUT /api/settings/members ERROR:", err);
    return NextResponse.json({ error: "Lỗi cập nhật quyền: " + err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authCheck = await requireAuth(["OWNER"]);
  if (authCheck.error) return authCheck.error;

  const { companyId, user } = authCheck;

  try {
    const url = new URL(request.url);
    const memberId = url.searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "Thiếu ID thành viên" }, { status: 400 });
    }

    // Verify member belongs to this company
    const member = await prisma.companyMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!member || member.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });
    }

    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Không thể xoá tài khoản Chủ sở hữu của doanh nghiệp" }, { status: 400 });
    }

    if (member.userId === user.id) {
      return NextResponse.json({ error: "Bạn không thể tự xoá chính mình khỏi doanh nghiệp" }, { status: 400 });
    }

    // 1. Delete CompanyMember record
    await prisma.companyMember.delete({
      where: { id: memberId }
    });

    // 2. Clear legacy user.companyId if it points to this company
    await prisma.user.updateMany({
      where: {
        id: member.userId,
        companyId: companyId,
      },
      data: {
        companyId: null,
      }
    });

    // 3. Delete any lingering invitation records for this user in this company
    if (member.user?.email) {
      await prisma.companyInvitation.deleteMany({
        where: {
          companyId: companyId,
          email: member.user.email,
        }
      });
    }

    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "DELETE",
      module: "settings",
      targetType: "CompanyMember",
      targetId: memberId,
      targetName: member.user?.name || member.user?.email || "Thành viên",
      description: `Đã xoá thành viên ${member.user?.name || member.user?.email} khỏi doanh nghiệp`,
    });

    return NextResponse.json({ success: true, message: "Đã xoá thành viên khỏi doanh nghiệp" });
  } catch (err: any) {
    console.error("DELETE /api/settings/members error:", err);
    return NextResponse.json({ error: "Lỗi khi xoá thành viên: " + err.message }, { status: 500 });
  }
}
