import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { staffingOverrideSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], [
    { module: "schedule", action: "VIEW" },
    { module: "shift_config", action: "VIEW" }
  ]);
  if (error || !companyId) return error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const overrides = await prisma.staffingOverride.findMany({
    where: {
      companyId,
      ...(storeId ? { storeId } : {}),
      ...(from && to
        ? {
            date: {
              gte: parseDateOnly(from),
              lte: parseDateOnly(to),
            },
          }
        : {}),
    },
    select: {
      id: true,
      storeId: true,
      shiftTemplateId: true,
      date: true,
      requiredStaff: true,
      shiftTemplate: { select: { id: true, name: true, startTime: true, endTime: true } },
      store: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { storeId: "asc" }],
  });

  return NextResponse.json(
    overrides.map((override) => ({
      ...override,
      date: formatDateOnly(override.date),
    }))
  );
}

export async function POST(request: Request) {
  const authCheck = await requireAuth(["OWNER"], { module: "shift_config", action: "EDIT" });
  if (authCheck.error || !authCheck.companyId) return authCheck.error;

  const { companyId, user } = authCheck;
  const body = await request.json();

  if (Array.isArray(body)) {
    const operations = [];
    for (const item of body) {
      const parsed = staffingOverrideSchema.safeParse(item);
      if (!parsed.success) continue;
      operations.push(
        prisma.staffingOverride.upsert({
          where: {
            storeId_shiftTemplateId_date: {
              storeId: parsed.data.storeId,
              shiftTemplateId: parsed.data.shiftTemplateId,
              date: parseDateOnly(parsed.data.date),
            },
          },
          create: {
            ...parsed.data,
            companyId,
            date: parseDateOnly(parsed.data.date),
          },
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
        targetType: "StaffingOverride",
        targetId: firstItem?.storeId || "batch",
        targetName: store?.name || "Định biên ngày",
        description: `Đã sao chép/điều chỉnh hàng loạt định biên theo ngày (${results.length} cấu hình) tại ${store?.name || "cửa hàng"}`,
        details: {
          storeName: store?.name,
          updatedCount: results.length,
        },
      });
    }

    return NextResponse.json(results);
  }

  const parsed = staffingOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const override = await prisma.staffingOverride.upsert({
    where: {
      storeId_shiftTemplateId_date: {
        storeId: parsed.data.storeId,
        shiftTemplateId: parsed.data.shiftTemplateId,
        date: parseDateOnly(parsed.data.date),
      },
    },
    create: {
      ...parsed.data,
      companyId,
      date: parseDateOnly(parsed.data.date),
    },
    update: { requiredStaff: parsed.data.requiredStaff },
  });

  if (user) {
    const [store, shift] = await Promise.all([
      prisma.store.findUnique({ where: { id: parsed.data.storeId }, select: { name: true } }),
      prisma.shiftTemplate.findUnique({ where: { id: parsed.data.shiftTemplateId }, select: { name: true, startTime: true, endTime: true } }),
    ]);

    const shiftLabel = shift ? `${shift.name} (${shift.startTime}-${shift.endTime})` : "Ca làm việc";

    await logActivity({
      companyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "UPDATE",
      module: "shift_config",
      targetType: "StaffingOverride",
      targetId: override.id,
      targetName: shift?.name || "Định biên ca",
      description: `Đã chỉnh số nhân viên ca ${shiftLabel} ngày ${parsed.data.date} tại ${store?.name || "cửa hàng"} thành ${parsed.data.requiredStaff} nhân viên`,
      details: {
        shiftName: shift?.name,
        shiftTime: shift ? `${shift.startTime} - ${shift.endTime}` : undefined,
        date: parsed.data.date,
        storeName: store?.name,
        requiredStaff: `${parsed.data.requiredStaff} nhân viên`,
      },
    });
  }

  return NextResponse.json({
    ...override,
    date: formatDateOnly(override.date),
  });
}
