import { prisma } from "@/lib/prisma";

export async function syncStoreShifts(storeId: string) {
  // 1. Lấy tất cả các ca đang hoạt động của cửa hàng
  const shifts = await prisma.shiftTemplate.findMany({
    where: { storeId, isActive: true },
    orderBy: { startTime: "asc" },
  });

  // 2. Cập nhật lại số lượng ca của cửa hàng
  await prisma.store.update({
    where: { id: storeId },
    data: { shiftsPerDay: shifts.length },
  });

  // 3. Cập nhật lại sortOrder cho từng ca theo đúng thứ tự giờ
  // Dùng Promise.all để chạy song song cho nhanh
  const updates = shifts.map((shift, index) => {
    if (shift.sortOrder !== index) {
      return prisma.shiftTemplate.update({
        where: { id: shift.id },
        data: { sortOrder: index },
      });
    }
    return Promise.resolve();
  });

  await Promise.all(updates);
}
