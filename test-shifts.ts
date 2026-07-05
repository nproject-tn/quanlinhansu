process.env.DATABASE_URL = "postgresql://postgres.psnhplnaaqxxtgbalyuo:nuvzyv-gaqtux-0vuHri@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";
import { prisma } from "./src/lib/prisma";

async function main() {
  const storeId = "store123";
  // 1. Create a store if not exist
  let store = await prisma.store.findFirst();
  if (!store) {
    store = await prisma.store.create({ data: { name: "Test Store", address: "123" } });
  }

  // delete old test shift
  await prisma.shiftTemplate.deleteMany({ where: { name: "Ca Test" } });

  // 2. Create a shift "Ca Test"
  const shift1 = await prisma.shiftTemplate.create({
    data: {
      storeId: store.id,
      name: "Ca Test",
      startTime: "08:00",
      endTime: "12:00",
      durationHours: 4,
      isActive: true,
    }
  });
  console.log("Created shift1:", shift1.name);

  // 3. Create a fake assignment so it gets soft deleted
  // Wait, shift assignment needs an employee. Let's just manually update it to simulate soft delete.
  await prisma.shiftTemplate.update({
    where: { id: shift1.id },
    data: { 
      isActive: false,
      name: `${shift1.name} (đã xóa ${Date.now().toString().slice(-6)})`
    }
  });
  console.log("Soft deleted shift1");

  // 4. Try to create "Ca Test" again
  try {
    const shift2 = await prisma.shiftTemplate.create({
      data: {
        storeId: store.id,
        name: "Ca Test",
        startTime: "12:00",
        endTime: "16:00",
        durationHours: 4,
        isActive: true,
      }
    });
    console.log("Created shift2 successfully:", shift2.name);
  } catch (e) {
    console.error("Failed to create shift2:", e);
  }
}
main().catch(console.error).finally(() => process.exit(0));
