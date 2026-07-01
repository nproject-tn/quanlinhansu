const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.scheduleApprovalRequest.findMany();
  console.log(JSON.stringify(requests, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
