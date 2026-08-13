import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@apexflow.vn' }
  });
  if (user) {
    console.log("Found user:", user.email);
    const valid = await bcrypt.compare('admin123', user.passwordHash);
    console.log("Password is valid:", valid);
  } else {
    console.log("User not found");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
