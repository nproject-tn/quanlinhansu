import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/client";

export async function getCompanyAccess(companyId: string) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const membership = await prisma.companyMember.findUnique({
    where: {
      userId_companyId: {
        userId: session.user.id,
        companyId: companyId,
      }
    },
    include: {
      company: { select: { isActive: true } }
    }
  });

  if (membership && !membership.company.isActive && !session.user.isSuperAdmin) {
    return null; // Block access to deleted companies
  }

  if (!membership) {
    if (session.user.isSuperAdmin) {
      return { 
        role: "ADMIN" as UserRole, 
        permissions: {}, // Super admin has full access anyway, but define it as empty object
        userId: session.user.id, 
        isSuperAdmin: true,
        employeeId: session.user.employeeId 
      };
    }
    return null;
  }

  return { 
    role: membership.role, 
    permissions: (membership.permissions as any) || {},
    userId: session.user.id, 
    isSuperAdmin: session.user.isSuperAdmin,
    employeeId: session.user.employeeId
  };
}

export async function verifyCompanyAccess(companyId: string) {
  const access = await getCompanyAccess(companyId);
  if (!access) {
    redirect("/workspaces");
  }
  return access;
}
