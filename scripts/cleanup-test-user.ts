import { prisma } from "../src/lib/prisma";

async function main() {
  // Delete the re-created membership for nguyenthanhnam16062001@gmail.com in tokyolife-hcm
  const user = await prisma.user.findUnique({
    where: { email: "nguyenthanhnam16062001@gmail.com" }
  });

  if (user) {
    await prisma.companyMember.deleteMany({
      where: {
        userId: user.id,
        companyId: "tokyolife-hcm"
      }
    });

    if (user.companyId === "tokyolife-hcm") {
      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: null }
      });
    }

    await prisma.companyInvitation.deleteMany({
      where: {
        companyId: "tokyolife-hcm",
        email: user.email
      }
    });

    console.log("Cleaned up nguyenthanhnam16062001@gmail.com from tokyolife-hcm successfully!");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
