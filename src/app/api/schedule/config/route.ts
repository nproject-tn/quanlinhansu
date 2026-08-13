import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "shift_config", action: "VIEW" });
  if (error || !companyId) return error;

  const config = await prisma.scheduleConfig.upsert({
    where: { companyId },
    create: { companyId, shiftsPerDay: 3 },
    update: {},
  });

  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const { error, companyId } = await requireAuth(["OWNER"], { module: "shift_config", action: "EDIT" });
  if (error || !companyId) return error;

  const body = await request.json();
  const shiftsPerDay = Number(body.shiftsPerDay);

  if (!Number.isFinite(shiftsPerDay) || shiftsPerDay < 1) {
    return NextResponse.json(
      { error: "Số ca mỗi ngày phải lớn hơn 0" },
      { status: 400 }
    );
  }

  const config = await prisma.scheduleConfig.upsert({
    where: { companyId },
    create: { companyId, shiftsPerDay },
    update: { shiftsPerDay },
  });

  return NextResponse.json(config);
}
