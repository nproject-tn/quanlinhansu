import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/client";

export async function getCompanyAccess(companyId: string) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  // Resolve target company ID if name was passed
  let targetCompanyId = companyId;
  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { id: companyId },
        { name: companyId }
      ]
    },
    select: { id: true, name: true, isActive: true }
  });

  if (company) {
    targetCompanyId = company.id;
    if (!company.isActive && !session.user.isSuperAdmin) {
      return null;
    }
  }

  const membership = await prisma.companyMember.findUnique({
    where: {
      userId_companyId: {
        userId: session.user.id,
        companyId: targetCompanyId,
      }
    },
    include: {
      company: { select: { id: true, name: true, isActive: true } },
      companyRole: { select: { permissions: true } },
    }
  });

  if (membership && !membership.company.isActive && !session.user.isSuperAdmin) {
    return null; // Block access to deleted companies
  }

  // Check if there is a pending ownership transfer for this user in this company
  const pendingTransfer = await prisma.ownershipTransfer.findFirst({
    where: {
      companyId: targetCompanyId,
      toUserId: session.user.id,
      status: "PENDING",
    },
    include: {
      fromUser: { select: { name: true, email: true } },
      company: { select: { name: true } },
    }
  });

  if (!membership) {
    if (session.user.isSuperAdmin) {
      return { 
        role: "ADMIN" as UserRole, 
        permissions: {}, // Super admin has full access anyway, but define it as empty object
        userId: session.user.id, 
        isSuperAdmin: true,
        employeeId: session.user.employeeId,
        companyDbId: targetCompanyId,
        pendingTransfer: pendingTransfer ? {
          id: pendingTransfer.id,
          fromName: pendingTransfer.fromUser.name,
          fromEmail: pendingTransfer.fromUser.email,
          companyName: pendingTransfer.company.name,
        } : null,
      };
    }
    return null;
  }

  let effectivePermissions: Record<string, any> | null = null;

  if (membership.permissions !== null && membership.permissions !== undefined && typeof membership.permissions === "object") {
    effectivePermissions = membership.permissions as Record<string, any>;
  } else if (membership.companyRole?.permissions) {
    effectivePermissions = membership.companyRole.permissions as Record<string, any>;
  }

  return { 
    role: membership.role, 
    permissions: effectivePermissions,
    userId: session.user.id, 

    isSuperAdmin: session.user.isSuperAdmin,
    employeeId: session.user.employeeId,
    companyDbId: targetCompanyId,
    pendingTransfer: pendingTransfer ? {
      id: pendingTransfer.id,
      fromName: pendingTransfer.fromUser.name,
      fromEmail: pendingTransfer.fromUser.email,
      companyName: pendingTransfer.company.name,
    } : null,
  };
}

export async function verifyCompanyAccess(companyId: string) {
  const access = await getCompanyAccess(companyId);
  if (!access) {
    redirect("/workspaces");
  }
  return access;
}
