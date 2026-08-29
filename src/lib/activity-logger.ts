import { prisma } from "@/lib/prisma";

export type LogActivityParams = {
  companyId: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "CANCEL" | "EXPORT" | "IMPORT" | "LOGIN";
  module: "employees" | "schedule" | "store" | "shift_config" | "products" | "revenue" | "settings" | "auth";
  targetType: string; // e.g. "Employee", "ShiftAssignment", "Product", "Order", "Store", "Role", "FactoryOrder", "Rule"
  targetId?: string | null;
  targetName?: string | null;
  description: string;
  details?: Record<string, any> | null;
};

/**
 * Non-blocking activity logger to track user operations across the platform
 */
export async function logActivity(params: LogActivityParams) {
  try {
    const userName = params.userName || params.userEmail || "Người dùng";
    const userEmail = params.userEmail || "";
    const userRole = params.userRole || "EMPLOYEE";

    return await prisma.activityLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        userName,
        userEmail,
        userRole,
        action: params.action,
        module: params.module,
        targetType: params.targetType,
        targetId: params.targetId || null,
        targetName: params.targetName || null,
        description: params.description,
        details: params.details || undefined,
      },
    });
  } catch (error) {
    // We log error but do not throw to prevent breaking primary user workflows
    console.error("[ActivityLogger] Failed to log activity:", error);
    return null;
  }
}
