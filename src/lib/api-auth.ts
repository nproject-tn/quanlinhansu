import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCompanyAccess } from "@/lib/dal";
import type { UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";

export async function requireAuth(
  allowedRoles?: UserRole[], 
  requiredPermissions?: { module: string; action: "VIEW" | "EDIT" | "APPROVE" | "REQUEST" | "EDIT_FREE" | "DELETE" | "VIEW_LIST" | "VIEW_HOURS" | "EDIT_PAST" } | { module: string; action: "VIEW" | "EDIT" | "APPROVE" | "REQUEST" | "EDIT_FREE" | "DELETE" | "VIEW_LIST" | "VIEW_HOURS" | "EDIT_PAST" }[]
) {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }) };
  }

  // Attempt to extract companyId from headers
  const reqHeaders = await headers();
  const referer = reqHeaders.get("referer");
  let companyId = reqHeaders.get("x-company-id");

  // If no explicit header, try to parse from referer (e.g., /app/[companyId]/... or ?companyId=...)
  if (referer && !companyId) {
    try {
      const url = new URL(referer);
      const match = url.pathname.match(/^\/(?:app|pos)\/([^\/]+)/);
      if (match && match[1]) {
        companyId = match[1];
      } else {
        const queryCompanyId = url.searchParams.get("companyId");
        if (queryCompanyId) companyId = queryCompanyId;
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

  // Supreme Owner / SuperAdmin always passes
  if (access.role === "OWNER" || access.isSuperAdmin) {
    return { session, user: session.user, companyId: access.companyDbId, permissions: access.permissions };
  }

  // If explicit permissions are required, check against effective permissions
  if (requiredPermissions) {
    const permsArray = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const canAccess = permsArray.some((reqPerm) =>
      hasPermission(access.role, access.permissions, reqPerm.module, reqPerm.action)
    );

    if (!canAccess) {
      return {
        error: NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 }),
      };
    }
  } else if (allowedRoles) {
    // If no explicit permission is required, check base role
    if (!allowedRoles.includes(access.role)) {
      return {
        error: NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 }),
      };
    }
  }

  return { session, user: session.user, companyId: access.companyDbId, permissions: access.permissions };
}

