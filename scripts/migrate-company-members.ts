import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { prisma } from '../src/lib/prisma';

async function main() {
  console.log("Starting data migration for multi-tenant and OAuth...");

  // 1. Ensure SuperAdmin exists or will be flagged
  const superAdminEmail = 'thanhnamnguyen16091999@gmail.com';
  let superAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  
  if (superAdmin) {
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { isSuperAdmin: true }
    });
    console.log(`Updated ${superAdminEmail} to be Super Admin.`);
  } else {
    superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        name: 'Thành Nam Nguyễn',
        isSuperAdmin: true,
      }
    });
    console.log(`Created Super Admin user: ${superAdminEmail}`);
  }

  // 2. Ensure jennyhuynh170@gmail.com is set up properly
  const ownerEmail = 'jennyhuynh170@gmail.com';
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: 'Jenny Huỳnh',
      }
    });
    console.log(`Created user: ${ownerEmail}`);
  }

  // Ensure 'tokyolife-hcm' company exists
  let tokyolife = await prisma.company.findUnique({ where: { id: 'tokyolife-hcm' } });
  if (!tokyolife) {
    tokyolife = await prisma.company.create({
      data: {
        id: 'tokyolife-hcm',
        name: 'Tokyolife HCM',
      }
    });
  }

  // Make jennyhuynh170@gmail.com the OWNER of tokyolife-hcm
  await prisma.companyMember.upsert({
    where: {
      userId_companyId: {
        userId: owner.id,
        companyId: tokyolife.id
      }
    },
    update: { role: 'OWNER' },
    create: {
      userId: owner.id,
      companyId: tokyolife.id,
      role: 'OWNER'
    }
  });
  console.log(`Assigned ${ownerEmail} as OWNER of Tokyolife HCM`);

  // 3. Migrate all existing User.companyId + User.role into CompanyMember
  const allUsers = await prisma.user.findMany({
    where: { companyId: { not: null } }
  });

  console.log(`Found ${allUsers.length} users with legacy companyId. Migrating to CompanyMembers...`);

  let count = 0;
  for (const user of allUsers) {
    if (!user.companyId || !user.role) continue;
    // Don't overwrite Jenny if we just made her OWNER
    if (user.email === ownerEmail && user.companyId === 'tokyolife-hcm') {
      continue; 
    }

    try {
      await prisma.companyMember.upsert({
        where: {
          userId_companyId: {
            userId: user.id,
            companyId: user.companyId
          }
        },
        update: { role: user.role },
        create: {
          userId: user.id,
          companyId: user.companyId,
          role: user.role
        }
      });
      count++;
    } catch (e) {
      console.error(`Error migrating user ${user.email}:`, e);
    }
  }

  console.log(`Successfully migrated ${count} user memberships.`);
  console.log("Migration complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
