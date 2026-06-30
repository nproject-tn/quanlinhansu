import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const config = await prisma.scheduleConfig.upsert({
    where: { id: "default" },
    create: { id: "default", shiftsPerDay: 3 },
    update: {},
  });

  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await request.json();
  const shiftsPerDay = Number(body.shiftsPerDay);

  if (!Number.isFinite(shiftsPerDay) || shiftsPerDay < 1) {
    return NextResponse.json(
      { error: "Số ca mỗi ngày phải lớn hơn 0" },
      { status: 400 }
    );
  }

  const config = await prisma.scheduleConfig.upsert({
    where: { id: "default" },
    create: { id: "default", shiftsPerDay },
    update: { shiftsPerDay },
  });

  return NextResponse.json(config);
}
