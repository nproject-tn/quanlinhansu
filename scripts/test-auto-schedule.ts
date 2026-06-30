import "dotenv/config";
import { format } from "date-fns";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  autoAssignShifts,
  buildAssignmentSlots,
  getDateRange,
  getDaysInRange,
} from "../src/lib/schedule-engine";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const adapter = new PrismaPg({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter });

  const referenceDate = new Date("2026-06-29");
  const { start, end } = getDateRange("week", referenceDate);
  const dates = getDaysInRange(start, end);

  const stores = await prisma.store.findMany({ where: { isActive: true } });
  const storeIds = stores.map((s) => s.id);
  const shifts = await prisma.shiftTemplate.findMany({ where: { storeId: { in: storeIds } } });
  const rules = await prisma.staffingRule.findMany({ where: { storeId: { in: storeIds } } });
  const overrides = await prisma.staffingOverride.findMany({
    where: { storeId: { in: storeIds }, date: { gte: start, lte: end } },
  });
  const existing = await prisma.shiftAssignment.findMany({
    where: { storeId: { in: storeIds }, date: { gte: start, lte: end } },
  });
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: { stores: true },
  });

  let slots = buildAssignmentSlots(
    dates,
    stores,
    shifts,
    rules,
    overrides,
    existing.map((e) => ({
      id: e.id,
      storeId: e.storeId,
      shiftTemplateId: e.shiftTemplateId,
      date: e.date,
      slotIndex: e.slotIndex,
      employeeId: e.employeeId,
    }))
  );

  slots = autoAssignShifts(
    slots,
    employees.map((e) => ({
      id: e.id,
      name: e.name,
      maxShiftsPerMonth: e.maxShiftsPerMonth,
      maxHoursPerMonth: e.maxHoursPerMonth,
      storeIds: e.stores.map((s) => s.storeId),
    })),
    shifts,
    true
  );

  await prisma.shiftAssignment.deleteMany({
    where: { storeId: { in: storeIds }, date: { gte: start, lte: end }, isManual: false },
  });

  const toCreate = slots
    .filter((s) => s.employeeId)
    .map((s) => ({
      storeId: s.storeId,
      shiftTemplateId: s.shiftTemplateId,
      date: s.date,
      slotIndex: s.slotIndex,
      employeeId: s.employeeId!,
      isManual: false,
    }));

  const result = await prisma.shiftAssignment.createMany({ data: toCreate, skipDuplicates: true });

  console.log(`✅ Xếp ca test: ${result.count}/${slots.length} ca đã lưu`);
  console.log(`   Ca trống: ${slots.filter((s) => !s.employeeId).length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
