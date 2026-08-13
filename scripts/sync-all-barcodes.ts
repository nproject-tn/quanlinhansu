import { prisma } from "../src/lib/prisma";
import { generateEan8Barcode } from "../src/lib/sku-engine";

async function main() {
  console.log("=== SYNC ALL PRODUCT BARCODES WITH MANUFACTURER CODE ===");

  const products = await prisma.product.findMany({
    include: {
      manufacturer: true,
    },
  });

  console.log(`Found ${products.length} products to check.`);

  let updatedCount = 0;

  for (const p of products) {
    const mCode = p.manufacturer ? p.manufacturer.code : "000";
    const pCode = p.barcode.length >= 7 ? p.barcode.slice(3, 7) : "0001";
    const expectedBarcode = generateEan8Barcode(mCode, pCode);

    if (p.barcode !== expectedBarcode) {
      console.log(`Updating Product "${p.name}" (SKU: ${p.sku}): ${p.barcode} -> ${expectedBarcode} (NSX: ${p.manufacturer?.name || "Mặc định"} [${mCode}])`);

      await prisma.product.update({
        where: { id: p.id },
        data: {
          barcode: expectedBarcode,
          barcodeNeedsReprint: true,
        },
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} / ${products.length} product barcodes in database.`);
}

main()
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
