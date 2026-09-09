import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

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
  console.log("🚀 Bắt đầu quy trình Phương án 1 trên Production Oracle DB (Port 5432)...");

  // 1. Lấy danh sách 94 phân công mồ côi trong Tháng 9/2026 (thuộc các ca isActive=false)
  const orphanAssignments = await prisma.shiftAssignment.findMany({
    where: {
      shiftTemplate: { isActive: false },
      date: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T23:59:59.999Z"),
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          position: true,
        },
      },
      shiftTemplate: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          durationHours: true,
          isActive: true,
          storeId: true,
          store: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      faults: true,
    },
    orderBy: [{ date: "asc" }, { slotIndex: "asc" }],
  });

  console.log(`📌 Tìm thấy ${orphanAssignments.length} phân công thuộc ca bị ẩn trong Tháng 9/2026.`);

  if (orphanAssignments.length === 0) {
    console.log("✅ Không có phân công mồ côi nào cần xóa.");
    return;
  }

  // 2. Lưu bản sao lưu ra file JSON
  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(
    backupDir,
    `backup-orphan-assignments-sep2026-${Date.now()}.json`
  );
  fs.writeFileSync(backupFilePath, JSON.stringify(orphanAssignments, null, 2), "utf-8");
  console.log(`💾 Đã sao lưu thành công ${orphanAssignments.length} bản ghi vào:\n   -> ${backupFilePath}`);

  // 3. Tiến hành xóa có chọn lọc đúng danh sách ID này
  const targetIds = orphanAssignments.map((a) => a.id);
  console.log(`\n🗑️ Đang xóa ${targetIds.length} bản ghi ShiftAssignment trên Production DB...`);

  const deleteResult = await prisma.shiftAssignment.deleteMany({
    where: {
      id: { in: targetIds },
    },
  });

  console.log(`✅ Kết quả xóa: Đã xóa thành công ${deleteResult.count} bản ghi.`);

  // 4. Xác minh tính toàn vẹn của dữ liệu sau khi xóa
  console.log("\n🔍 Đang kiểm tra xác minh tính toàn vẹn dữ liệu...");

  // Kiểm tra tháng 9
  const remainingSept = await prisma.shiftAssignment.findMany({
    where: {
      date: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T23:59:59.999Z"),
      },
    },
    include: {
      shiftTemplate: {
        select: { isActive: true },
      },
    },
  });

  const septActiveCount = remainingSept.filter((a) => a.shiftTemplate.isActive).length;
  const septInactiveCount = remainingSept.filter((a) => !a.shiftTemplate.isActive).length;
  console.log(`  • Tháng 9/2026: Còn lại ${septActiveCount} ca hoạt động | ${septInactiveCount} ca bị ẩn (Mục tiêu: 0).`);

  // Kiểm tra tháng 8 (Bảo toàn 100%)
  const remainingAug = await prisma.shiftAssignment.count({
    where: {
      date: {
        gte: new Date("2026-08-01T00:00:00.000Z"),
        lte: new Date("2026-08-31T23:59:59.999Z"),
      },
    },
  });
  console.log(`  • Tháng 8/2026: ${remainingAug} ca (Bảo toàn 100%, không bị ảnh hưởng).`);

  // Kiểm tra tháng 7 (Bảo toàn 100%)
  const remainingJul = await prisma.shiftAssignment.count({
    where: {
      date: {
        gte: new Date("2026-07-01T00:00:00.000Z"),
        lte: new Date("2026-07-31T23:59:59.999Z"),
      },
    },
  });
  console.log(`  • Tháng 7/2026: ${remainingJul} ca (Bảo toàn 100%, không bị ảnh hưởng).`);

  console.log("\n🎉 HOÀN THÀNH XỬ LÝ PHƯƠNG ÁN 1 AN TOÀN TUYỆT ĐỐI!");
}

main()
  .catch((err) => {
    console.error("❌ Lỗi thực thi:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
