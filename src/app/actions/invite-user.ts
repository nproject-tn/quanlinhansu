"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyCompanyAccess } from "@/lib/dal";
import type { UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function inviteUserToCompany(companyId: string, email: string, role: UserRole) {
  try {
    const access = await verifyCompanyAccess(companyId);
    if (!access || (access.role !== "ADMIN" && access.role !== "OWNER")) {
      return { success: false, error: "Không có quyền thực hiện thao tác này" };
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: {
            userId: existingUser.id,
            companyId,
          }
        }
      });

      if (existingMembership) {
        return { error: "Người dùng này đã là thành viên của doanh nghiệp" };
      }
    }

    // Check if invitation already exists
    const existingInvite = await prisma.companyInvitation.findUnique({
      where: {
        email_companyId: {
          email,
          companyId,
        }
      }
    });

    if (existingInvite) {
      if (existingInvite.status === "PENDING") {
        return { error: "Đã gửi lời mời đến email này rồi" };
      } else {
        // Old invitation exists (e.g. they were deleted), clean it up so we can re-invite
        await prisma.companyInvitation.delete({
          where: { id: existingInvite.id }
        });
      }
    }

    await prisma.companyInvitation.create({
      data: {
        email,
        companyId,
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    revalidatePath(`/app/${companyId}/nhan-vien`);
    return { success: true };
  } catch (error) {
    console.error("Invite error:", error);
    return { error: "Lỗi khi gửi lời mời" };
  }
}
