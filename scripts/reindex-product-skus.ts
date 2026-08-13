import { prisma } from "../src/lib/prisma";
import { generateSku, getColorCode, getSizeCode } from "../src/lib/sku-engine";

async function main() {
  console.log("🔄 Starting Product SKU & ItemCode Re-indexing...");

  const companies = await prisma.company.findMany();

  for (const company of companies) {
    console.log(`\n🏢 Processing Company: ${company.name} (${company.id})`);

    const subcategories = await prisma.subcategory.findMany({
      where: { companyId: company.id },
      include: { category: true },
    });

    for (const subcat of subcategories) {
      const products = await prisma.product.findMany({
        where: { companyId: company.id, subcategoryId: subcat.id },
        orderBy: { createdAt: "asc" },
      });

      if (products.length === 0) continue;

      // Group products by lowercase name
      const groupedByName = new Map<string, typeof products>();
      for (const p of products) {
        const nameKey = p.name.trim().toLowerCase();
        if (!groupedByName.has(nameKey)) {
          groupedByName.set(nameKey, []);
        }
        groupedByName.get(nameKey)!.push(p);
      }

      let itemIndex = 1;
      for (const [nameKey, prodGroup] of groupedByName.entries()) {
        const itemCode = String(itemIndex).padStart(2, "0");
        console.log(`  📦 Product Line "${prodGroup[0].name}" -> Assigned ItemCode: ${itemCode} (${prodGroup.length} variants)`);

        for (const p of prodGroup) {
          const colorCode = p.colorCode || getColorCode(p.colorName || "");
          const sizeCode = p.sizeCode || getSizeCode(p.sizeName || "");

          const newSku = generateSku(
            subcat.category.codeLetter,
            subcat.codeLetter,
            itemCode,
            colorCode,
            sizeCode
          );

          await prisma.product.update({
            where: { id: p.id },
            data: {
              itemCode,
              colorCode,
              sizeCode,
              sku: newSku,
            },
          });
          console.log(`     ✅ Variant ID ${p.id}: SKU updated to ${newSku}`);
        }
        itemIndex++;
      }
    }
  }

  console.log("\n🎉 Re-indexing complete!");
}

main()
  .catch((e) => {
    console.error("❌ Migration Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
