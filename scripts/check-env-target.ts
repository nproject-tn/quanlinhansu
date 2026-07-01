import "dotenv/config";

function safeHost(urlString: string) {
  try {
    return new URL(urlString).host;
  } catch {
    return "(khong doc duoc host)";
  }
}

function safeProjectHint(urlString: string) {
  try {
    const host = new URL(urlString).host;
    const match = host.match(/([a-z0-9-]+)\.(supabase\.co|pooler\.supabase\.com)$/i);
    if (!match) return host;
    return match[1];
  } catch {
    return "(khong doc duoc project ref)";
  }
}

const databaseUrl = process.env.DATABASE_URL ?? "";
const directUrl = process.env.DIRECT_URL ?? "";
const authUrl = process.env.AUTH_URL ?? "";

console.log("=== ENV CHECK ===");
console.log(`DATABASE_URL host: ${databaseUrl ? safeHost(databaseUrl) : "(thieu)"}`);
console.log(`DIRECT_URL host:   ${directUrl ? safeHost(directUrl) : "(thieu)"}`);
console.log(`AUTH_URL:          ${authUrl || "(chua set)"}`);

if (databaseUrl) {
  console.log(`DATABASE_URL ref:  ${safeProjectHint(databaseUrl)}`);
}
if (directUrl) {
  console.log(`DIRECT_URL ref:    ${safeProjectHint(directUrl)}`);
}

const isProdManualFile = process.env.DOTENV_CONFIG_PATH === ".env.production.manual";
if (isProdManualFile) {
  console.log("CANH BAO: ban dang dung file env production manual.");
} else {
  console.log("Ban dang dung env mac dinh cua local.");
}
