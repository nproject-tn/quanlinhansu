import { config } from 'dotenv';
config();
import { prisma } from "./src/lib/prisma";

async function main() {
  const shifts = await prisma.shiftTemplate.findMany({
    where: { isActive: false }
  });
  
  for (const s of shifts) {
    if (!s.name.includes('(đã xóa')) {
      const newName = `${s.name} (đã xóa ${Date.now().toString().slice(-6)})`;
      await prisma.shiftTemplate.update({
        where: { id: s.id },
        data: { name: newName }
      });
      console.log(`Renamed ${s.name} to ${newName}`);
    }
  }
}
main().catch(console.error).finally(() => process.exit(0));
