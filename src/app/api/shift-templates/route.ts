import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { shiftTemplateSchema } from "@/lib/validations";
import { calcDurationHours } from "@/lib/shift-utils";

export async function GET(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  const includeStore = searchParams.get("includeStore") === "1";

  const shiftTemplates = await prisma.shiftTemplate.findMany({
    where: {
      isActive: true,
      ...(storeId ? { storeId } : {}),
    },
    select: {
      id: true,
      storeId: true,
      name: true,
      startTime: true,
      endTime: true,
      durationHours: true,
      sortOrder: true,
      isActive: true,
      ...(includeStore
        ? { store: { select: { id: true, name: true } } }
        : {}),
    },
    orderBy: [{ storeId: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json(shiftTemplates);
}

export async function POST(request: Request) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await request.json();
  const parsed = shiftTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const durationHours = calcDurationHours(parsed.data.startTime, parsed.data.endTime);
  const template = await prisma.shiftTemplate.create({
    data: { ...parsed.data, durationHours },
  });

  // Đồng bộ số lượng ca và thứ tự ca
  const { syncStoreShifts } = await import("@/lib/api-shift-utils");
  await syncStoreShifts(parsed.data.storeId);

  return NextResponse.json(template, { status: 201 });
}

export async function PUT(request: Request) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await request.json();
  const { id, ...rest } = body;
  const parsed = shiftTemplateSchema.safeParse(rest);
  if (!parsed.success || !id) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const durationHours = calcDurationHours(parsed.data.startTime, parsed.data.endTime);
  const template = await prisma.shiftTemplate.update({
    where: { id },
    data: { ...parsed.data, durationHours },
  });

  // Đồng bộ thứ tự ca
  const { syncStoreShifts } = await import("@/lib/api-shift-utils");
  await syncStoreShifts(parsed.data.storeId);

  return NextResponse.json(template);
}
