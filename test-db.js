const { PrismaClient } = require('./src/generated/prisma/index.js');
const prisma = new PrismaClient();

async function main() {
  const assignments = await prisma.shiftAssignment.findMany({
    include: {
      employee: true,
      shiftTemplate: {
        include: { store: true }
      }
    }
  });

  for (const a of assignments) {
    if (a.employeeId && a.employee) {
      console.log(`[${a.date.toISOString().split('T')[0]}] ${a.shiftTemplate.store.name} - ${a.shiftTemplate.name} (Slot ${a.slotIndex}): ${a.employee.name} (ID: ${a.employeeId})`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
