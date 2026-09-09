import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

const prodEnvPath = path.resolve(process.cwd(), ".env.production.manual");
const envConfig = dotenv.config({ path: prodEnvPath });

const url = envConfig.parsed?.DIRECT_URL || envConfig.parsed?.DATABASE_URL;

if (!url) {
  console.error("❌ Thiếu connection string trong .env.production.manual");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Đang phân tích dữ liệu Tháng 9/2026 trên Production DB...");

  // 1. Tìm các ShiftTemplate bị ẩn/isActive=false hoặc có tên 'đã xóa'
  const deactivatedShifts = await prisma.shiftTemplate.findMany({
    where: {
      OR: [
        { isActive: false },
        { name: { contains: "đã xóa" } }
      ]
    },
    select: {
      id: true,
      storeId: true,
      periodId: true,
      name: true,
      startTime: true,
      endTime: true,
      durationHours: true,
      isActive: true,
      _count: {
        select: {
          shiftAssignments: true
        }
      }
    }
  });

  console.log(`\n📌 Tìm thấy ${deactivatedShifts.length} ca làm việc bị ẩn/xóa mềm:`);
  for (const s of deactivatedShifts) {
    console.log(`  - [${s.id}] ${s.name} (${s.startTime} - ${s.endTime}, ${s.durationHours}h) | isActive: ${s.isActive} | periodId: ${s.periodId} | Số phân công: ${s._count.shiftAssignments}`);
  }

  // 2. Tìm các phân công trong Tháng 9/2026 gắn với ca bị ẩn
  const deactivatedShiftIds = deactivatedShifts.map(s => s.id);
  const orphanAssignments = await prisma.shiftAssignment.findMany({
    where: {
      shiftTemplateId: { in: deactivatedShiftIds },
      date: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T23:59:59.999Z"),
      }
    },
    select: {
      id: true,
      date: true,
      slotIndex: true,
      employee: {
        select: {
          id: true,
          name: true,
        }
      },
      shiftTemplate: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          durationHours: true,
          isActive: true
        }
      }
    },
    orderBy: [{ date: "asc" }, { slotIndex: "asc" }]
  });

  console.log(`\n📌 Tổng số phân công 'vô hình' (gắn với ca bị ẩn) trong Tháng 9: ${orphanAssignments.length}`);
  
  // Tổng hợp theo nhân viên
  const empHoursMap: Record<string, { name: string; count: number; hours: number; dates: string[] }> = {};
  for (const a of orphanAssignments) {
    const empName = a.employee?.name || "(Chưa gán NV)";
    if (!empHoursMap[empName]) {
      empHoursMap[empName] = { name: empName, count: 0, hours: 0, dates: [] };
    }
    empHoursMap[empName].count += 1;
    empHoursMap[empName].hours += a.shiftTemplate.durationHours;
    const dStr = a.date.toISOString().split("T")[0];
    if (!empHoursMap[empName].dates.includes(dStr)) {
      empHoursMap[empName].dates.push(dStr);
    }
  }

  console.log("\n📊 Chi tiết giờ làm của các ca 'vô hình' theo từng nhân viên:");
  for (const [name, data] of Object.entries(empHoursMap)) {
    console.log(`  • ${name}: ${data.hours}h (${data.count} ca) - Các ngày: ${data.dates.join(", ")}`);
  }

  // 3. Phân tích các ShiftTemplate đang isActive=true trong Tháng 9
  const activeShifts = await prisma.shiftTemplate.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      durationHours: true,
      periodId: true,
      period: {
        select: {
          name: true,
          startDate: true,
          endDate: true
        }
      },
      _count: {
        select: {
          shiftAssignments: true
        }
      }
    }
  });

  console.log(`\n📌 Tổng số ca đang HOẠT ĐỘNG (isActive=true): ${activeShifts.length}`);
  for (const s of activeShifts) {
    console.log(`  - [${s.id}] ${s.name} (${s.startTime}-${s.endTime}) | Bảng: ${s.period?.name ?? "Bảng mặc định"} | Phân công: ${s._count.shiftAssignments}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
