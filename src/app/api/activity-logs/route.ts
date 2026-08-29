import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getAuditLogScope } from "@/lib/permissions";

export async function GET(request: Request) {
  const { error, session, user, companyId, permissions } = await requireAuth();
  if (error) return error;

  // Verify permission scope: NONE, SELF, CUSTOM, ALL
  const auditScope = getAuditLogScope(user.role, permissions);

  if (auditScope.scope === "NONE") {
    return NextResponse.json(
      { error: "Bạn không có quyền xem lịch sử thao tác hệ thống", logs: [] },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const moduleParam = searchParams.get("module");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const andConditions: any[] = [{ companyId }];

  // 1. Module filter
  if (moduleParam && moduleParam !== "ALL") {
    andConditions.push({ module: moduleParam });
  }

  // 2. Search filter
  if (search) {
    andConditions.push({
      OR: [
        { description: { contains: search, mode: "insensitive" } },
        { userName: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
        { targetName: { contains: search, mode: "insensitive" } },
        { targetType: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  // 3. User Scope filter
  if (auditScope.scope === "SELF") {
    andConditions.push({
      OR: [
        { userId: user.id },
        { userEmail: user.email },
      ],
    });
  } else if (auditScope.scope === "CUSTOM") {
    const targetUserIds = Array.from(new Set([...auditScope.allowedUserIds, user.id])).filter(Boolean);
    const targetEmails = Array.from(new Set([...auditScope.allowedEmails, user.email])).filter(Boolean);

    const customOr: any[] = [];
    if (targetUserIds.length > 0) {
      customOr.push({ userId: { in: targetUserIds } });
    }
    if (targetEmails.length > 0) {
      customOr.push({ userEmail: { in: targetEmails } });
    }

    if (customOr.length > 0) {
      andConditions.push({ OR: customOr });
    } else {
      andConditions.push({
        OR: [
          { userId: user.id },
          { userEmail: user.email },
        ],
      });
    }
  }
  // If auditScope.scope === "ALL", no user constraint is added -> can view all

  const whereClause: any = { AND: andConditions };

  try {
    const [logs, stores, employees, shiftTemplates] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.store.findMany({ where: { companyId }, select: { id: true, name: true } }),
      prisma.employee.findMany({ where: { companyId }, select: { id: true, name: true } }),
      prisma.shiftTemplate.findMany({ where: { companyId }, select: { id: true, name: true, startTime: true, endTime: true } }),
    ]);

    const storeMap = new Map(stores.map((s) => [s.id, s.name]));
    const employeeMap = new Map(employees.map((e) => [e.id, e.name]));
    const shiftMap = new Map(shiftTemplates.map((s) => [s.id, `${s.name} (${s.startTime} - ${s.endTime})`]));

    const enrichedLogs = logs.map((log) => {
      if (!log.details || typeof log.details !== "object" || Array.isArray(log.details)) {
        return log;
      }

      const raw = log.details as Record<string, any>;
      const enrichedDetails: Record<string, any> = {};

      for (const [k, v] of Object.entries(raw)) {
        const valStr = String(v ?? "");
        
        if (k === "sourceStoreId") {
          enrichedDetails["Từ cửa hàng"] = storeMap.get(valStr) || valStr;
        } else if (k === "targetStoreId") {
          enrichedDetails["Đến cửa hàng"] = storeMap.get(valStr) || valStr;
        } else if (k === "sourceShiftTemplateId") {
          enrichedDetails["Từ ca"] = shiftMap.get(valStr) || valStr;
        } else if (k === "targetShiftTemplateId") {
          enrichedDetails["Đến ca"] = shiftMap.get(valStr) || valStr;
        } else if (k === "sourceDate") {
          enrichedDetails["Từ ngày"] = valStr;
        } else if (k === "targetDate") {
          enrichedDetails["Đến ngày"] = valStr;
        } else if (k === "sourceSlotIndex") {
          enrichedDetails["Từ vị trí"] = `Vị trí ${Number(valStr) + 1}`;
        } else if (k === "targetSlotIndex") {
          enrichedDetails["Đến vị trí"] = `Vị trí ${Number(valStr) + 1}`;
        } else if (k === "storeId") {
          enrichedDetails["Cửa hàng"] = storeMap.get(valStr) || valStr;
        } else if (k === "shiftTemplateId") {
          enrichedDetails["Ca làm việc"] = shiftMap.get(valStr) || valStr;
        } else if (k === "employeeId") {
          enrichedDetails["Nhân viên"] = employeeMap.get(valStr) || (valStr ? valStr : "Làm trống ca");
        } else if (k === "date") {
          enrichedDetails["Ngày làm việc"] = valStr;
        } else if (k === "createdCount") {
          enrichedDetails["Số ca đã xếp"] = valStr;
        } else if (k === "unfilledCount") {
          enrichedDetails["Số ca còn trống"] = valStr;
        } else if (k === "deletedCount") {
          enrichedDetails["Số ca đã xoá"] = valStr;
        } else if (k === "mode") {
          enrichedDetails["Chế độ xếp ca"] = valStr === "week" ? "Theo tuần" : valStr === "month" ? "Theo tháng" : valStr;
        } else if (k === "referenceDate") {
          enrichedDetails["Ngày mốc"] = valStr;
        } else {
          // Check if value itself matches any store/employee/shift ID
          if (storeMap.has(valStr)) {
            enrichedDetails[k] = storeMap.get(valStr);
          } else if (employeeMap.has(valStr)) {
            enrichedDetails[k] = employeeMap.get(valStr);
          } else if (shiftMap.has(valStr)) {
            enrichedDetails[k] = shiftMap.get(valStr);
          } else {
            enrichedDetails[k] = v;
          }
        }
      }

      return {
        ...log,
        details: enrichedDetails,
      };
    });

    return NextResponse.json({ logs: enrichedLogs });
  } catch (err: any) {
    console.error("GET /api/activity-logs error:", err);
    return NextResponse.json(
      { error: "Không tải được lịch sử thao tác" },
      { status: 500 }
    );
  }
}
