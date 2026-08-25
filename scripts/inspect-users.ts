import { prisma } from "../src/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, companyId: true }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const members = await prisma.companyMember.findMany({
    include: {
      user: { select: { email: true, name: true } },
      company: { select: { id: true, name: true } },
      companyRole: { select: { name: true } },
    }
  });
  console.log("MEMBERS:", JSON.stringify(members, null, 2));

  const invitations = await prisma.companyInvitation.findMany({
    include: {
      company: { select: { id: true, name: true } }
    }
  });
  console.log("INVITATIONS:", JSON.stringify(invitations, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
