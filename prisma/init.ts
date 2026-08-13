import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const connectionString = "postgresql://postgres:YOUR_STRONG_PASSWORD@140.245.105.160:5432/quanlinhansu?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.company.upsert({
    where: { name: "tokyolife-hcm" },
    create: { id: "tokyolife-hcm", name: "tokyolife-hcm" },
    update: { id: "tokyolife-hcm" },
  });
  console.log("Inserted company!");
}

main().catch(console.error).finally(() => process.exit(0));
