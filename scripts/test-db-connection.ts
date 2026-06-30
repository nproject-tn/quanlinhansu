import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!url) {
    console.error("❌ Chưa có DATABASE_URL hoặc DIRECT_URL trong file .env");
    process.exit(1);
  }

  if (url.startsWith("prisma+postgres://")) {
    console.error("❌ DATABASE_URL vẫn đang dùng Prisma local.");
    console.error("   Hãy thay bằng connection string từ Supabase (xem .env.example)");
    process.exit(1);
  }

  const isSupabase = url.includes("supabase");
  console.log(`🔌 Đang kết nối ${isSupabase ? "Supabase" : "PostgreSQL"}...`);

  const adapter = new PrismaPg({
    connectionString: url,
    ...(isSupabase ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    console.log("✅ Kết nối Supabase thành công!");
    console.log(`   Bảng hiện có: ${tables.length > 0 ? tables.map((t) => t.tablename).join(", ") : "(chưa có — chạy npm run db:push)"}`);
  } catch (error) {
    console.error("❌ Kết nối thất bại:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    console.error("\nKiểm tra lại:");
    console.error("  • Mật khẩu database đúng chưa?");
    console.error("  • Project Supabase đã khởi động xong chưa? (đợi ~2 phút sau khi tạo)");
    console.error("  • Dùng Direct URL (port 5432) cho lệnh này");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
