import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCompanyAccess } from "@/lib/dal";
import type { UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";

export async function requireAuth(
  allowedRoles?: UserRole[], 
  requiredPermissions?: { module: string; action: "VIEW" | "EDIT" | "APPROVE" | "REQUEST" | "EDIT_FREE" | "DELETE" | "VIEW_LIST" | "VIEW_HOURS" } | { module: string; action: "VIEW" | "EDIT" | "APPROVE" | "REQUEST" | "EDIT_FREE" | "DELETE" | "VIEW_LIST" | "VIEW_HOURS" }[]
) {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }) };
  }

  // Attempt to extract companyId from headers
  const reqHeaders = await headers();
  const referer = reqHeaders.get("referer");
  let companyId = reqHeaders.get("x-company-id");

  // If no explicit header, try to parse from referer (e.g., /app/[companyId]/...)
  if (referer && !companyId) {
    try {
      const url = new URL(referer);
      const match = url.pathname.match(/^\/app\/([^\/]+)/);
      if (match && match[1]) {
        companyId = match[1];
      }
    } catch (e) {
      // ignore
    }
  }

  // Fallback to session companyId if it's the old single-tenant way
  if (!companyId) {
    companyId = session.user.companyId || null;
  }

  if (!companyId) {
    return { error: NextResponse.json({ error: "Thiếu Company ID để xác thực quyền hạn" }, { status: 400 }) };
  }

  const access = await getCompanyAccess(companyId);

  if (!access) {
    return { error: NextResponse.json({ error: "Không tìm thấy thông tin quyền truy cập cho doanh nghiệp này" }, { status: 403 }) };
  }

  // Inject the dynamically verified role for this company
  session.user.role = access.role;

  let hasRoleAccess = false;
  if (!allowedRoles || allowedRoles.includes(access.role) || (allowedRoles.includes("ADMIN") && access.role === "OWNER")) {
    hasRoleAccess = true;
  }

  let hasPermissionAccess = false;
  if (requiredPermissions) {
    const permissions = access.permissions as any;
    const permsArray = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    
    for (const reqPerm of permsArray) {
      if (hasPermission(access.role, permissions, reqPerm.module, reqPerm.action)) {
        hasPermissionAccess = true;
        break;
      }
    }
  } else {
    // If no explicit permission is required, we do NOT grant permission access
    hasPermissionAccess = false;
  }

  if (!hasRoleAccess && !hasPermissionAccess) {
    return {
      error: NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 }),
    };
  }

  return { session, companyId, permissions: access.permissions };
}
