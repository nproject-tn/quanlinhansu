import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL chưa được cấu hình. Xem .env.example để kết nối Supabase."
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
    }),
  });
}

function hasScheduleDayNoteModel(client: PrismaClient | undefined) {
  return typeof (client as PrismaClient & { scheduleDayNote?: unknown } | undefined)?.scheduleDayNote !== "undefined";
}

function hasStoreLogoField(client: PrismaClient | undefined) {
  const runtimeModel = (
    client as PrismaClient & {
      _runtimeDataModel?: {
        models?: Record<string, { fields?: Array<{ name: string }> }>;
      };
    } | undefined
  )?._runtimeDataModel;

  const storeFields = runtimeModel?.models?.Store?.fields ?? [];
  return storeFields.some((field) => field.name === "logoUrl");
}

const canReuseCachedClient =
  globalForPrisma.prisma &&
  hasScheduleDayNoteModel(globalForPrisma.prisma) &&
  hasStoreLogoField(globalForPrisma.prisma);

const cachedPrisma = canReuseCachedClient ? globalForPrisma.prisma : undefined;

export const prisma = cachedPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
