import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

const prodEnvPath = path.resolve(process.cwd(), '.env.production.manual');
const envConfig = dotenv.config({ path: prodEnvPath });

if (envConfig.error) {
  console.error("❌ Không tìm thấy file .env.production.manual");
  process.exit(1);
}

const databaseUrl = envConfig.parsed?.DATABASE_URL || process.env.DATABASE_URL;
const directUrl = envConfig.parsed?.DIRECT_URL || process.env.DIRECT_URL;

if (!databaseUrl || !directUrl) {
  console.error("❌ Thiếu DATABASE_URL hoặc DIRECT_URL trong .env.production.manual");
  process.exit(1);
}

console.log("🚀 Đang tiến hành đồng bộ CSDL Production...");
console.log(`🔗 Target: ${directUrl.split('@')[1].split('/')[0]}`);

try {
  execSync(`npx prisma db push`, {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: directUrl,
    },
    stdio: 'inherit'
  });
  console.log("✅ Đồng bộ Production DB thành công!");
} catch (error) {
  console.error("❌ Đồng bộ thất bại:", error);
  process.exit(1);
}
