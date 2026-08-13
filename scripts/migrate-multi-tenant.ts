import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load local .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("No DATABASE_URL in .env");
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
});

async function main() {
  await client.connect();
  console.log("Connected to local database.");

  try {
    await client.query("BEGIN");

    // 1. Create Enums if not exist
    console.log("Creating new Enums...");
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "RevenueSource" AS ENUM ('TIKTOK', 'SHOPEE', 'APEXFLOW_WEB', 'MANUAL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "AttendanceType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "AttendanceMethod" AS ENUM ('FACE_ID', 'MANUAL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Create Company table
    console.log("Creating Company table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Company" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
      );
    `);

    // Insert default company
    console.log("Inserting default Company...");
    await client.query(`
      INSERT INTO "Company" ("id", "name", "updatedAt") 
      VALUES ('tokyolife-hcm', 'Tokyolife HCM', CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING;
    `);

    // 3. Add companyId to tables
    const tables = [
      'User', 'Store', 'Employee', 'ShiftTemplate', 'StaffingRule', 
      'StaffingOverride', 'ShiftAssignment', 'ShiftOvertime', 
      'ScheduleApprovalRequest', 'ScheduleDayNote', 'ShiftFaults'
    ];

    for (const table of tables) {
      console.log(`Adding companyId to ${table}...`);
      // Add column if not exists
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}" ADD COLUMN "companyId" TEXT NOT NULL DEFAULT 'tokyolife-hcm';
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `);
      
      // Add foreign key constraint if not exists
      const fkQuery = `
        DO $$ BEGIN
          ALTER TABLE "${table}" ADD CONSTRAINT "${table}_companyId_fkey" 
          FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;
      await client.query(fkQuery);
    }

    // 4. ScheduleConfig needs companyId as primary key
    console.log("Migrating ScheduleConfig...");
    // Check if ScheduleConfig has id column, if so, rename it or migrate data
    const checkIdRes = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='ScheduleConfig' and column_name='id'
    `);
    if (checkIdRes.rowCount > 0) {
      // Add companyId, copy data, drop id
      await client.query(`ALTER TABLE "ScheduleConfig" ADD COLUMN IF NOT EXISTS "companyId" TEXT NOT NULL DEFAULT 'tokyolife-hcm'`);
      await client.query(`ALTER TABLE "ScheduleConfig" DROP CONSTRAINT IF EXISTS "ScheduleConfig_pkey"`);
      await client.query(`ALTER TABLE "ScheduleConfig" DROP COLUMN IF EXISTS "id"`);
      await client.query(`ALTER TABLE "ScheduleConfig" ADD CONSTRAINT "ScheduleConfig_pkey" PRIMARY KEY ("companyId")`);
      await client.query(`
        DO $$ BEGIN
          ALTER TABLE "ScheduleConfig" ADD CONSTRAINT "ScheduleConfig_companyId_fkey" 
          FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
    }

    // 5. Employee new columns
    console.log("Adding FaceID columns to Employee...");
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "Employee" ADD COLUMN "faceDescriptor" JSONB;
        ALTER TABLE "Employee" ADD COLUMN "referenceImage" TEXT;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `);

    // 6. Create RevenueRecord & AttendanceLog
    // Prisma db push will handle creating these tables cleanly because they are entirely new and have no data.
    
    await client.query("COMMIT");
    console.log("SQL Migration complete!");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
