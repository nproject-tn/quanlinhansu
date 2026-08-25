import { Client } from 'pg';

const SUPABASE_URL = 'postgresql://postgres:nifSin-modtiq-zefja9@db.xazgbiacpweiakcouwtf.supabase.co:5432/postgres';
const ORACLE_PROD_URL = 'postgresql://postgres:IdpyutdZI3y1qDHJaTn-gsoaG3l8MAUi@140.245.105.160:5432/quanlinhansu';
const TARGET_COMPANY_ID = 'tokyolife-hcm';
const TARGET_COMPANY_NAME = 'Tokyolife HCM';
const OWNER_EMAIL = 'jennyhuynh170@gmail.com';

async function main() {
  console.log("==================================================================");
  console.log("🚀 STARTING CLEAN MIGRATION: Supabase (Beta) -> Oracle Production DB");
  console.log("==================================================================");

  const supabase = new Client({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const oracle = new Client({
    connectionString: ORACLE_PROD_URL,
  });

  await supabase.connect();
  console.log("✅ Connected to Supabase.");

  await oracle.connect();
  console.log("✅ Connected to Oracle Production DB.");

  try {
    await oracle.query('BEGIN');
    console.log("🔒 Started Oracle DB transaction.");

    // 1. Ensure Company 'tokyolife-hcm'
    console.log("\n[1/12] Ensuring Company exists...");
    await oracle.query(`
      INSERT INTO "Company" ("id", "name", "isActive", "createdAt", "updatedAt")
      VALUES ($1, $2, true, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE 
      SET "name" = $2, "updatedAt" = NOW();
    `, [TARGET_COMPANY_ID, TARGET_COMPANY_NAME]);

    // 2. Ensure jennyhuynh170@gmail.com is Owner
    console.log("\n[2/12] Ensuring Owner user and CompanyMember...");
    let userRes = await oracle.query(`SELECT id FROM "User" WHERE "email" = $1`, [OWNER_EMAIL]);
    let ownerUserId: string;
    if (userRes.rowCount === 0) {
      const newUserRes = await oracle.query(`
        INSERT INTO "User" ("id", "email", "name", "role", "companyId", "createdAt", "updatedAt")
        VALUES ('user-jennyhuynh', $1, 'Thục Nhi Huỳnh Nguyễn', 'OWNER', $2, NOW(), NOW())
        RETURNING id;
      `, [OWNER_EMAIL, TARGET_COMPANY_ID]);
      ownerUserId = newUserRes.rows[0].id;
    } else {
      ownerUserId = userRes.rows[0].id;
      await oracle.query(`
        UPDATE "User" SET "role" = 'OWNER', "companyId" = $2 WHERE "id" = $1;
      `, [ownerUserId, TARGET_COMPANY_ID]);
    }

    await oracle.query(`
      INSERT INTO "CompanyMember" ("id", "userId", "companyId", "role", "createdAt", "updatedAt")
      VALUES (concat('cm-', $1::text, '-', $2::text), $1, $2, 'OWNER', NOW(), NOW())
      ON CONFLICT ("userId", "companyId") DO UPDATE
      SET "role" = 'OWNER', "updatedAt" = NOW();
    `, [ownerUserId, TARGET_COMPANY_ID]);
    console.log(`✅ ${OWNER_EMAIL} verified as OWNER of ${TARGET_COMPANY_NAME}`);

    // Clean existing Tokyolife child records to allow 100% clean ID recreation
    console.log("\n[Cleaning existing records for tokyolife-hcm to ensure foreign key integrity...]");
    await oracle.query(`DELETE FROM "ShiftFaults" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "ShiftOvertime" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "ShiftAssignment" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "StaffingOverride" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "StaffingRule" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "ShiftTemplate" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "EmployeeStore" WHERE "employeeId" IN (SELECT id FROM "Employee" WHERE "companyId" = $1)`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "Employee" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "Store" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    await oracle.query(`DELETE FROM "ScheduleDayNote" WHERE "companyId" = $1`, [TARGET_COMPANY_ID]);
    console.log("✅ Cleared prior Tokyolife schedule & store data.");

    // 3. Migrate Stores
    console.log("\n[3/12] Migrating Stores...");
    const storesRes = await supabase.query(`SELECT * FROM "Store"`);
    for (const store of storesRes.rows) {
      await oracle.query(`
        INSERT INTO "Store" ("id", "name", "address", "logoUrl", "shiftsPerDay", "sortOrder", "isActive", "companyId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), COALESCE($7, true), $8, $9, $10);
      `, [
        store.id,
        store.name,
        store.address,
        store.logoUrl,
        store.shiftsPerDay ?? 3,
        store.sortOrder ?? store.order ?? 0,
        store.isActive ?? true,
        TARGET_COMPANY_ID,
        store.createdAt ?? new Date(),
        store.updatedAt ?? new Date(),
      ]);
    }
    console.log(`✅ Inserted ${storesRes.rowCount} Stores.`);

    // 4. Migrate ShiftTemplates
    console.log("\n[4/12] Migrating ShiftTemplates...");
    const templatesRes = await supabase.query(`SELECT * FROM "ShiftTemplate"`);
    for (const st of templatesRes.rows) {
      await oracle.query(`
        INSERT INTO "ShiftTemplate" ("id", "storeId", "name", "startTime", "endTime", "durationHours", "sortOrder", "isActive", "companyId")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `, [
        st.id,
        st.storeId,
        st.name,
        st.startTime,
        st.endTime,
        st.durationHours,
        st.sortOrder ?? 0,
        st.isActive ?? true,
        TARGET_COMPANY_ID,
      ]);
    }
    console.log(`✅ Inserted ${templatesRes.rowCount} ShiftTemplates.`);

    // 5. Migrate StaffingRules
    console.log("\n[5/12] Migrating StaffingRules...");
    const rulesRes = await supabase.query(`SELECT * FROM "StaffingRule"`);
    for (const sr of rulesRes.rows) {
      await oracle.query(`
        INSERT INTO "StaffingRule" ("id", "storeId", "shiftTemplateId", "dayOfWeek", "requiredStaff", "companyId")
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [
        sr.id,
        sr.storeId,
        sr.shiftTemplateId,
        sr.dayOfWeek,
        sr.requiredStaff,
        TARGET_COMPANY_ID,
      ]);
    }
    console.log(`✅ Inserted ${rulesRes.rowCount} StaffingRules.`);

    // 6. Migrate StaffingOverrides
    console.log("\n[6/12] Migrating StaffingOverrides...");
    const overridesRes = await supabase.query(`SELECT * FROM "StaffingOverride"`);
    for (const so of overridesRes.rows) {
      await oracle.query(`
        INSERT INTO "StaffingOverride" ("id", "storeId", "shiftTemplateId", "date", "requiredStaff", "companyId")
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [
        so.id,
        so.storeId,
        so.shiftTemplateId,
        so.date,
        so.requiredStaff,
        TARGET_COMPANY_ID,
      ]);
    }
    console.log(`✅ Inserted ${overridesRes.rowCount} StaffingOverrides.`);

    // 7. Migrate Employees
    console.log("\n[7/12] Migrating Employees...");
    const employeesRes = await supabase.query(`SELECT * FROM "Employee"`);
    for (const emp of employeesRes.rows) {
      await oracle.query(`
        INSERT INTO "Employee" (
          "id", "name", "phone", "email", "employmentType", "position", 
          "salaryType", "monthlySalary", "hourlyRate", "maxShiftsPerWeek", 
          "maxShiftsPerMonth", "maxHoursPerMonth", "isActive", "deletedAt", 
          "companyId", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);
      `, [
        emp.id,
        emp.name,
        emp.phone,
        emp.email,
        emp.employmentType,
        emp.position,
        emp.salaryType,
        emp.monthlySalary,
        emp.hourlyRate,
        emp.maxShiftsPerWeek ?? 7,
        emp.maxShiftsPerMonth ?? 30,
        emp.maxHoursPerMonth ?? 200,
        emp.isActive ?? true,
        emp.deletedAt,
        TARGET_COMPANY_ID,
        emp.createdAt ?? new Date(),
        emp.updatedAt ?? new Date(),
      ]);
    }
    console.log(`✅ Inserted ${employeesRes.rowCount} Employees.`);

    // 8. Migrate EmployeeStore relations
    console.log("\n[8/12] Migrating EmployeeStore relations...");
    const empStoreRes = await supabase.query(`SELECT * FROM "EmployeeStore"`);
    for (const es of empStoreRes.rows) {
      await oracle.query(`
        INSERT INTO "EmployeeStore" ("id", "employeeId", "storeId")
        VALUES ($1, $2, $3);
      `, [
        es.id,
        es.employeeId,
        es.storeId,
      ]);
    }
    console.log(`✅ Inserted ${empStoreRes.rowCount} EmployeeStore relations.`);

    // 9. Migrate ShiftAssignments
    console.log("\n[9/12] Migrating ShiftAssignments...");
    const assignRes = await supabase.query(`SELECT * FROM "ShiftAssignment"`);
    for (const sa of assignRes.rows) {
      await oracle.query(`
        INSERT INTO "ShiftAssignment" ("id", "storeId", "shiftTemplateId", "employeeId", "date", "slotIndex", "isManual", "companyId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
      `, [
        sa.id,
        sa.storeId,
        sa.shiftTemplateId,
        sa.employeeId,
        sa.date,
        sa.slotIndex ?? 0,
        sa.isManual ?? false,
        TARGET_COMPANY_ID,
        sa.createdAt ?? new Date(),
        sa.updatedAt ?? new Date(),
      ]);
    }
    console.log(`✅ Inserted ${assignRes.rowCount} ShiftAssignments.`);

    // 10. Migrate ShiftOvertime
    console.log("\n[10/12] Migrating ShiftOvertime...");
    const overtimeRes = await supabase.query(`SELECT * FROM "ShiftOvertime"`);
    for (const ot of overtimeRes.rows) {
      await oracle.query(`
        INSERT INTO "ShiftOvertime" ("id", "storeId", "shiftTemplateId", "employeeId", "date", "hours", "companyId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `, [
        ot.id,
        ot.storeId,
        ot.shiftTemplateId,
        ot.employeeId,
        ot.date,
        ot.hours,
        TARGET_COMPANY_ID,
        ot.createdAt ?? new Date(),
        ot.updatedAt ?? new Date(),
      ]);
    }
    console.log(`✅ Inserted ${overtimeRes.rowCount} ShiftOvertimes.`);

    // 11. Migrate ShiftFaults
    console.log("\n[11/12] Migrating ShiftFaults...");
    const faultsRes = await supabase.query(`SELECT * FROM "ShiftFaults"`);
    for (const fault of faultsRes.rows) {
      await oracle.query(`
        INSERT INTO "ShiftFaults" ("id", "assignmentId", "employeeId", "note", "evidenceUrl", "companyId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [
        fault.id,
        fault.assignmentId,
        fault.employeeId,
        fault.note,
        fault.evidenceUrl,
        TARGET_COMPANY_ID,
        fault.createdAt ?? new Date(),
        fault.updatedAt ?? new Date(),
      ]);
    }
    console.log(`✅ Inserted ${faultsRes.rowCount} ShiftFaults.`);

    // 12. Migrate ScheduleDayNotes & ScheduleConfig
    console.log("\n[12/12] Migrating ScheduleDayNotes & ScheduleConfig...");
    const notesRes = await supabase.query(`SELECT * FROM "ScheduleDayNote"`);
    for (const note of notesRes.rows) {
      await oracle.query(`
        INSERT INTO "ScheduleDayNote" ("id", "companyId", "date", "note", "colorKey", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [
        note.id,
        TARGET_COMPANY_ID,
        note.date,
        note.note,
        note.colorKey ?? 'amber',
        note.createdAt ?? new Date(),
        note.updatedAt ?? new Date(),
      ]);
    }
    console.log(`✅ Inserted ${notesRes.rowCount} ScheduleDayNotes.`);

    const configRes = await supabase.query(`SELECT * FROM "ScheduleConfig" LIMIT 1`);
    if (configRes.rowCount > 0) {
      const cfg = configRes.rows[0];
      await oracle.query(`
        INSERT INTO "ScheduleConfig" ("companyId", "shiftsPerDay", "updatedAt")
        VALUES ($1, $2, $3)
        ON CONFLICT ("companyId") DO UPDATE SET
          "shiftsPerDay" = EXCLUDED."shiftsPerDay",
          "updatedAt" = EXCLUDED."updatedAt";
      `, [
        TARGET_COMPANY_ID,
        cfg.shiftsPerDay ?? 3,
        cfg.updatedAt ?? new Date(),
      ]);
      console.log(`✅ Upserted ScheduleConfig for ${TARGET_COMPANY_ID}.`);
    }

    await oracle.query('COMMIT');
    console.log("\n==================================================================");
    console.log("🎉 ALL DATA MIGRATED & COMMITTED SUCCESSFULLY TO ORACLE PROD DB!");
    console.log("==================================================================");

  } catch (err) {
    await oracle.query('ROLLBACK');
    console.error("❌ MIGRATION FAILED! Transaction rolled back cleanly:", err);
    throw err;
  } finally {
    await supabase.end();
    await oracle.end();
  }
}

main().catch(() => process.exit(1));
