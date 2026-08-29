import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { staffingRuleSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";

const DAY_OF_WEEK_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export async function GET(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], [
    { module: "schedule", action: "VIEW" },
    { module: "shift_config", action: "VIEW" }
  ]);
  if (error || !companyId) return error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  const rules = await prisma.staffingRule.findMany({
    where: { companyId, ...(storeId ? { storeId } : {}) },
    select: {
      id: true,
      storeId: true,
      shiftTemplateId: true,
      dayOfWeek: true,
      requiredStaff: true,
    },
    orderBy: [{ storeId: "asc" }, { shiftTemplateId: "asc" }, { dayOfWeek: "asc" }],
  });

  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const authCheck = await requireAuth(["OWNER"], { module: "shift_config", action: "EDIT" });
  if (authCheck.error || !authCheck.companyId) return authCheck.error;

  const { companyId, user } = authCheck;
  const body = await request.json();

  if (Array.isArray(body)) {
    const operations = [];
    for (const item of body) {
      const parsed = staffingRuleSchema.safeParse(item);
      if (!parsed.success) continue;
      operations.push(
        prisma.staffingRule.upsert({
          where: {
            storeId_shiftTemplateId_dayOfWeek: {
              storeId: parsed.data.storeId,
              shiftTemplateId: parsed.data.shiftTemplateId,
              dayOfWeek: parsed.data.dayOfWeek,
            },
          },
          create: { ...parsed.data, companyId },
          update: { requiredStaff: parsed.data.requiredStaff },
        })
      );
    }
    const results = operations.length > 0 ? await prisma.$transaction(operations) : [];

    if (results.length > 0 && user) {
      const firstItem = body[0];
      const store = firstItem?.storeId ? await prisma.store.findUnique({ where: { id: firstItem.storeId }, select: { name: true } }) : null;
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "UPDATE",
        module: "shift_config",
        targetType: "StaffingRule",
        targetId: firstItem?.storeId || "batch",
        targetName: store?.name || "Quy định ca",
        description: `Đã cập nhật hàng loạt định biên số nhân viên (${results.length} cấu hình) tại ${store?.name || "cửa hàng"}`,
        details: {
          storeName: store?.name,
          updatedCount: results.length,
        },
      });
    }

    return NextResponse.json(results);
  }

  const parsed = staffingRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rule = await prisma.staffingRule.upsert({
    where: {
      storeId_shiftTemplateId_dayOfWeek: {
        storeId: parsed.data.storeId,
        shiftTemplateId: parsed.data.shiftTemplateId,
        dayOfWeek: parsed.data.dayOfWeek,
      },
    },
    create: { ...parsed.data, companyId },
    update: { requiredStaff: parsed.data.requiredStaff },
  });

  if (user) {
    const [store, shift] = await Promise.all([
      prisma.store.findUnique({ where: { id: parsed.data.storeId }, select: { name: true } }),
      prisma.shiftTemplate.findUnique({ where: { id: parsed.data.shiftTemplateId }, select: { name: true, startTime: true, endTime: true } }),
    ]);

    const dayName = DAY_OF_WEEK_NAMES[parsed.data.dayOfWeek] || `Thứ ${parsed.data.dayOfWeek}`;
    const shiftLabel = shift ? `${shift.name} (${shift.startTime}-${shift.endTime})` : "Ca làm việc";

    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "UPDATE",
      module: "shift_config",
      targetType: "StaffingRule",
      targetId: rule.id,
      targetName: shift?.name || "Định biên ca",
      description: `Đã chỉnh số nhân viên ca ${shiftLabel} vào ${dayName} tại ${store?.name || "cửa hàng"} thành ${parsed.data.requiredStaff} nhân viên`,
      details: {
        shiftName: shift?.name,
        shiftTime: shift ? `${shift.startTime} - ${shift.endTime}` : undefined,
        dayOfWeek: dayName,
        storeName: store?.name,
        requiredStaff: `${parsed.data.requiredStaff} nhân viên`,
      },
    });
  }

  return NextResponse.json(rule);
}
