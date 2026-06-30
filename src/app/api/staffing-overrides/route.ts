import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { staffingOverrideSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const overrides = await prisma.staffingOverride.findMany({
    where: {
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
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

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
            date: parseDateOnly(parsed.data.date),
          },
          update: { requiredStaff: parsed.data.requiredStaff },
        })
      );
    }
    const results = operations.length > 0 ? await prisma.$transaction(operations) : [];
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
      date: parseDateOnly(parsed.data.date),
    },
    update: { requiredStaff: parsed.data.requiredStaff },
  });

  return NextResponse.json({
    ...override,
    date: formatDateOnly(override.date),
  });
}
