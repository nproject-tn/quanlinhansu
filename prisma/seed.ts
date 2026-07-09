import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
const isSupabase = connectionString.includes("supabase");

const adapter = new PrismaPg({
  connectionString,
  ...(isSupabase ? { ssl: { rejectUnauthorized: false } } : {}),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn("⚠️ CẢNH BÁO: Đang ở môi trường Production. Bỏ qua việc seed dữ liệu rác để bảo vệ DB.");
    return;
  }

  console.log("🌱 Đang seed dữ liệu mẫu...");

  await prisma.scheduleConfig.upsert({
    where: { id: "default" },
    create: { id: "default", shiftsPerDay: 3 },
    update: {},
  });

  const store1 = await prisma.store.upsert({
    where: { id: "seed-store-1" },
    create: {
      id: "seed-store-1",
      name: "Cửa hàng Quận 1",
      address: "123 Nguyễn Huệ, Q1, TP.HCM",
      shiftsPerDay: 3,
    },
    update: { shiftsPerDay: 3 },
  });

  const store2 = await prisma.store.upsert({
    where: { id: "seed-store-2" },
    create: {
      id: "seed-store-2",
      name: "Cửa hàng Quận 7",
      address: "456 Nguyễn Thị Thập, Q7, TP.HCM",
      shiftsPerDay: 3,
    },
    update: { shiftsPerDay: 3 },
  });

  const shiftDefs = [
    { name: "Ca 1", startTime: "08:00", endTime: "11:00", durationHours: 3, sortOrder: 0 },
    { name: "Ca 2", startTime: "11:00", endTime: "14:00", durationHours: 3, sortOrder: 1 },
    { name: "Ca 3", startTime: "14:00", endTime: "17:00", durationHours: 3, sortOrder: 2 },
  ];

  for (const store of [store1, store2]) {
    for (const def of shiftDefs) {
      const shift = await prisma.shiftTemplate.upsert({
        where: { storeId_name: { storeId: store.id, name: def.name } },
        create: { storeId: store.id, ...def },
        update: def,
      });

      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
        const requiredStaff = dayOfWeek === 0 || dayOfWeek === 6 ? 2 : 1;
        await prisma.staffingRule.upsert({
          where: {
            storeId_shiftTemplateId_dayOfWeek: {
              storeId: store.id,
              shiftTemplateId: shift.id,
              dayOfWeek,
            },
          },
          create: {
            storeId: store.id,
            shiftTemplateId: shift.id,
            dayOfWeek,
            requiredStaff,
          },
          update: { requiredStaff },
        });
      }
    }
  }

  const employeeData = [
    { name: "Nguyễn Văn An", position: "Thu ngân", type: "FULL_TIME" as const, maxShifts: 6, maxHours: 180 },
    { name: "Trần Thị Bình", position: "Bán hàng", type: "FULL_TIME" as const, maxShifts: 6, maxHours: 180 },
    { name: "Lê Minh Cường", position: "Bán hàng", type: "PART_TIME" as const, maxShifts: 4, maxHours: 80 },
    { name: "Phạm Thu Dung", position: "Thu ngân", type: "PART_TIME" as const, maxShifts: 4, maxHours: 80 },
    { name: "Hoàng Văn Em", position: "Bán hàng", type: "FULL_TIME" as const, maxShifts: 5, maxHours: 160 },
    { name: "Võ Thị Phương", position: "Bán hàng", type: "PART_TIME" as const, maxShifts: 3, maxHours: 60 },
    { name: "Đặng Quốc Giang", position: "Quản ca", type: "FULL_TIME" as const, maxShifts: 6, maxHours: 180 },
    { name: "Bùi Thị Hoa", position: "Bán hàng", type: "PART_TIME" as const, maxShifts: 4, maxHours: 72 },
  ];

  const employees = [];
  for (const [i, emp] of employeeData.entries()) {
    const employee = await prisma.employee.upsert({
      where: { id: `seed-emp-${i + 1}` },
      create: {
        id: `seed-emp-${i + 1}`,
        name: emp.name,
        position: emp.position,
        employmentType: emp.type,
        salaryType: emp.type === "FULL_TIME" ? "FIXED_MONTHLY" : "HOURLY",
        monthlySalary: emp.type === "FULL_TIME" ? 8000000 : null,
        hourlyRate: emp.type === "PART_TIME" ? 35000 : null,
        maxShiftsPerMonth: emp.maxShifts * 4,
        maxHoursPerMonth: emp.maxHours,
        stores: {
          create: [{ storeId: store1.id }, { storeId: store2.id }],
        },
      },
      update: {
        name: emp.name,
        position: emp.position,
        maxShiftsPerMonth: emp.maxShifts * 4,
        maxHoursPerMonth: emp.maxHours,
      },
    });
    employees.push(employee);
  }

  const adminHash = await bcrypt.hash("admin123", 10);
  const schedulerHash = await bcrypt.hash("scheduler123", 10);
  const employeeHash = await bcrypt.hash("employee123", 10);

  await prisma.user.upsert({
    where: { email: "admin@apexflow.vn" },
    create: {
      email: "admin@apexflow.vn",
      passwordHash: adminHash,
      name: "Quản trị viên",
      role: "ADMIN",
    },
    update: { passwordHash: adminHash },
  });

  await prisma.user.upsert({
    where: { email: "scheduler@apexflow.vn" },
    create: {
      email: "scheduler@apexflow.vn",
      passwordHash: schedulerHash,
      name: "Người xếp ca",
      role: "SCHEDULER",
    },
    update: { passwordHash: schedulerHash },
  });

  await prisma.user.upsert({
    where: { email: "nhanvien1@apexflow.vn" },
    create: {
      email: "nhanvien1@apexflow.vn",
      passwordHash: employeeHash,
      name: employees[0].name,
      role: "EMPLOYEE",
      employeeId: employees[0].id,
    },
    update: { passwordHash: employeeHash, employeeId: employees[0].id },
  });

  console.log("✅ Seed hoàn tất!");
  console.log("Tài khoản:");
  console.log("  Admin: admin@apexflow.vn / admin123");
  console.log("  Xếp ca: scheduler@apexflow.vn / scheduler123");
  console.log("  NV: nhanvien1@apexflow.vn / employee123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
