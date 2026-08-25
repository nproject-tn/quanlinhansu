import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL
  })
});

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { in: ["jennyhuynh170@gmail.com", "namn83893@gmail.com"] }
    },
    include: {
      companyMemberships: true
    }
  });

  console.log("Found users:", JSON.stringify(users, null, 2));

  for (const user of users) {
    for (const membership of user.companyMemberships) {
      if (membership.role === "OWNER") {
        await prisma.companyMember.update({
          where: { id: membership.id },
          data: { role: "EMPLOYEE" }
        });
        console.log(`Updated membership ${membership.id} for ${user.email} to EMPLOYEE`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
