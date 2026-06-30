import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { staffingRuleSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  const rules = await prisma.staffingRule.findMany({
    where: storeId ? { storeId } : undefined,
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
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

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
          create: parsed.data,
          update: { requiredStaff: parsed.data.requiredStaff },
        })
      );
    }
    const results = operations.length > 0 ? await prisma.$transaction(operations) : [];
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
    create: parsed.data,
    update: { requiredStaff: parsed.data.requiredStaff },
  });

  return NextResponse.json(rule);
}
