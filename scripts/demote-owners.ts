import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("No DATABASE_URL");
    return;
  }

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  const allMembers = await prisma.companyMember.findMany({
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
      company: { select: { id: true, name: true } },
      companyRole: { select: { id: true, name: true } }
    }
  });

  console.log("=== ALL MEMBERS ACROSS COMPANIES ===");
  console.log(JSON.stringify(allMembers, null, 2));

  // Find jennyhuynh170@gmail.com and reset to no permissions
  const jenny = await prisma.user.findUnique({
    where: { email: "jennyhuynh170@gmail.com" },
    include: { companyMemberships: true }
  });

  if (jenny) {
    console.log("Found jenny:", jenny);
    // Update User legacy role if needed
    await prisma.user.update({
      where: { id: jenny.id },
      data: { role: "EMPLOYEE" }
    });

    for (const mem of jenny.companyMemberships) {
      await prisma.companyMember.update({
        where: { id: mem.id },
        data: {
          role: "EMPLOYEE",
          companyRoleId: null,
          permissions: null,
        }
      });
      console.log(`Reset membership ${mem.id} for jennyhuynh170@gmail.com to EMPLOYEE with no role and no permissions`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
