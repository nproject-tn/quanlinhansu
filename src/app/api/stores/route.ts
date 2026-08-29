import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import {
  isMissingStoreLogoColumn,
  retryStoreMutationWithoutLogo,
} from "@/lib/store-logo-fallback";
import { storeSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], [
    { module: "store", action: "VIEW" },
    { module: "revenue", action: "VIEW" },
    { module: "schedule", action: "VIEW" },
  ]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const lean = searchParams.get("lean") === "1";

  let stores;

  try {
    stores = await prisma.store.findMany({
      where: { companyId, isActive: true },
      select: lean
        ? {
            id: true,
            name: true,
            logoUrl: true,
            shiftsPerDay: true,
          }
        : {
            id: true,
            name: true,
            address: true,
            logoUrl: true,
            shiftsPerDay: true,
            isActive: true,
            shiftTemplates: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: { id: true, name: true, startTime: true, endTime: true },
            },
            _count: { select: { employees: true } },
          },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  } catch (queryError) {
    if (!isMissingStoreLogoColumn(queryError)) {
      console.error("GET /api/stores failed", queryError);
      return NextResponse.json({ error: "Không tải được cửa hàng" }, { status: 500 });
    }

    stores = await prisma.store.findMany({
      where: { companyId, isActive: true },
      select: lean
        ? {
            id: true,
            name: true,
            shiftsPerDay: true,
          }
        : {
            id: true,
            name: true,
            address: true,
            shiftsPerDay: true,
            isActive: true,
            shiftTemplates: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              select: { id: true, name: true, startTime: true, endTime: true },
            },
            _count: { select: { employees: true } },
          },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  return NextResponse.json(stores);
}

export async function POST(request: Request) {
  const { error, companyId, user } = await requireAuth(["OWNER"], { module: "store", action: "EDIT" });
  if (error) return error;

  const body = await request.json();
  const parsed = storeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { logoUrl: _logoUrl, ...dataWithoutLogo } = parsed.data;
    const { result: store, logoPendingMigration } = await retryStoreMutationWithoutLogo(
      Boolean(parsed.data.logoUrl),
      () => prisma.store.create({ data: { ...parsed.data, companyId } }),
      () => prisma.store.create({ data: { ...dataWithoutLogo, companyId } })
    );

    if (user) {
      await logActivity({
        companyId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: "CREATE",
        module: "store",
        targetType: "Store",
        targetId: store.id,
        targetName: store.name,
        description: `Đã tạo cửa hàng mới: ${store.name}`,
        details: {
          name: store.name,
          address: store.address,
        },
      });
    }

    return NextResponse.json({ ...store, logoPendingMigration }, { status: 201 });
  } catch (createError) {
    console.error("POST /api/stores failed", createError);
    return NextResponse.json({ error: "Không tạo được cửa hàng" }, { status: 500 });
  }
}
