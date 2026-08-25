/**
 * SKU & EAN-8 Barcode Logic Engine
 */

/**
 * Calculates EAN-8 Modulo 10 Check Digit for a 7-digit numeric string.
 * Algorithmic steps:
 * 1. Sum digits at odd positions (1st, 3rd, 5th, 7th).
 * 2. Multiply result by 3.
 * 3. Sum digits at even positions (2nd, 4th, 6th).
 * 4. Total = Step 2 + Step 3.
 * 5. Remainder = Total % 10.
 * 6. Check Digit = Remainder === 0 ? 0 : 10 - Remainder.
 */
export function calculateEan8Checksum(sevenDigits: string): number {
  const digits = sevenDigits.padStart(7, "0").slice(0, 7).split("").map(Number);
  
  // Odd positions: 1st, 3rd, 5th, 7th (0-indexed: 0, 2, 4, 6)
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6];
  
  // Even positions: 2nd, 4th, 6th (0-indexed: 1, 3, 5)
  const evenSum = digits[1] + digits[3] + digits[5];
  
  const total = oddSum * 3 + evenSum;
  const remainder = total % 10;
  
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Generates an 8-digit EAN-8 Barcode.
 * @param manufacturerCode 3-digit manufacturer prefix (e.g., "893")
 * @param productCode 4-digit product code (e.g., "0012")
 */
export function generateEan8Barcode(manufacturerCode: string, productCode: string): string {
  const mCode = (manufacturerCode || "000").padStart(3, "0").slice(0, 3);
  const pCode = (productCode || "0001").padStart(4, "0").slice(0, 4);
  const sevenDigits = `${mCode}${pCode}`;
  const checkDigit = calculateEan8Checksum(sevenDigits);
  return `${sevenDigits}${checkDigit}`;
}

/**
 * Generates SKU based on category letter (Chủng loại), material letter (Chất vải/Nguyên liệu), 2-digit random item code, 2-digit color code, and 2-digit size code.
 * Structure: [CatLetter (1)][MaterialLetter (1)][ItemCode (2)][ColorCode (2)][SizeCode (2)] = 8 characters
 * Example: VX010605 (V = Áo thun, X = Thun giấy, 01 = Tên SP, 06 = Màu Vàng, 05 = Size XL)
 */
export function generateSku(
  categoryLetter: string,
  subcategoryLetter: string,
  itemCode: string,
  colorCode: string,
  sizeCode: string
): string {
  const cat = (categoryLetter || "A").slice(0, 1).toUpperCase();
  const subcat = (subcategoryLetter || "B").slice(0, 1).toUpperCase();
  let item = (itemCode || "01").padStart(2, "0");
  if (item.length > 2) item = item.slice(-2);
  const color = (colorCode || "00").padStart(2, "0").slice(-2);
  const size = (sizeCode || "00").padStart(2, "0").slice(-2);

  return `${cat}${subcat}${item}${color}${size}`;
}

/**
 * Generates a random uppercase capital letter A-Z.
 */
export function getRandomCapitalLetter(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters.charAt(Math.floor(Math.random() * letters.length));
}

/**
 * Generates single capital letter deterministically or randomly for Category/Material.
 */
export function stringToUniqueLetter(name: string): string {
  if (!name.trim()) return "X";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 37 + name.charCodeAt(i)) % 26;
  }
  return String.fromCharCode(65 + hash);
}

/**
 * Automatically generates a random unused 2-digit numeric item code (e.g., "01".."99")
 * that guarantees no collision exists for the given category & subcategory prefix.
 */
export function getUniqueItemCode(existingSkus: string[], catLet: string, subcatLet: string): string {
  const prefix = `${(catLet || "A").slice(0, 1)}${(subcatLet || "B").slice(0, 1)}`.toUpperCase();
  const usedNumbers = new Set<number>();

  for (const sku of existingSkus) {
    if (!sku) continue;
    const clean = sku.trim().toUpperCase();
    if (clean.startsWith(prefix)) {
      const numericPart = clean.slice(2, 4);
      if (/^\d{2}$/.test(numericPart)) {
        usedNumbers.add(parseInt(numericPart, 10));
      }
    }
  }

  // Find unused 2-digit numbers
  const unused: number[] = [];
  for (let num = 1; num <= 99; num++) {
    if (!usedNumbers.has(num)) {
      unused.push(num);
    }
  }

  if (unused.length > 0) {
    const randomPick = unused[Math.floor(Math.random() * unused.length)];
    return String(randomPick).padStart(2, "0");
  }

  return "01";
}

/**
 * Generates a random N-digit numeric string for product model numbers.
 */
export function generateRandomNumericCode(length: number = 2): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

export function indexToLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

/**
 * Predefined Size Code mapping table (e.g. XS -> 01, S -> 02, M -> 03, L -> 04, XL -> 05, XXL -> 06...)
 */
export const SIZE_CODE_MAP: Record<string, string> = {
  F: "00",
  FREE: "00",
  FREESIZE: "00",
  XS: "01",
  S: "02",
  M: "03",
  L: "04",
  XL: "05",
  XXL: "06",
  "2XL": "06",
  XXXL: "07",
  "3XL": "07",
  "4XL": "08",
  "5XL": "09",
};

export function getSizeCode(sizeName?: string): string {
  if (!sizeName) return "00";
  const normalized = sizeName.trim().toUpperCase().replace(/\s+/g, "");
  if (SIZE_CODE_MAP[normalized]) return SIZE_CODE_MAP[normalized];
  
  // If size is numeric (e.g., shoe size 28, 29, 30, 39, 40, 41)
  const num = parseInt(normalized, 10);
  if (!isNaN(num) && num > 0 && num <= 99) {
    return String(num).padStart(2, "0");
  }
  
  // Reusable 2-digit hash for custom size
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 37 + normalized.charCodeAt(i)) % 80;
  }
  return String(hash + 11).padStart(2, "0");
}

/**
 * Color Code Generator helper (hash/index based 2-digit)
 */
export const COMMON_COLOR_CODES: Record<string, string> = {
  "trắng": "01", "white": "01",
  "đen": "02", "black": "02",
  "đỏ": "03", "red": "03",
  "xanh dương": "04", "blue": "04",
  "xanh lá": "05", "green": "05",
  "vàng": "06", "yellow": "06",
  "cam": "07", "orange": "07",
  "hồng": "08", "pink": "08",
  "tím": "09", "purple": "09",
  "xám": "10", "gray": "10", "grey": "10",
  "nâu": "11", "brown": "11",
  "kem": "12", "beige": "12",
};

export function getColorCode(colorName?: string): string {
  if (!colorName) return "00";
  const name = colorName.trim().toLowerCase();
  
  if (COMMON_COLOR_CODES[name]) return COMMON_COLOR_CODES[name];
  
  // Deterministic 2-digit code for custom color (13 - 99)
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 87;
  }
  return String(hash + 13).padStart(2, "0");
}

/**
 * Auto-generates Brand Code from Brand Name.
 * Format: 1 Letter + 2 Digits (e.g. "Dakblancy" -> "D01", "Adidas" -> "A01").
 */
export function generateBrandCode(brandName?: string | null): { brandName: string; brandCode: string } {
  const cleanName = (brandName || "").trim();
  if (!cleanName) {
    return { brandName: "", brandCode: "" };
  }
  const cleanChar = cleanName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const firstLetter = cleanChar.charAt(0) || "B";
  return {
    brandName: cleanName,
    brandCode: `${firstLetter}01`,
  };
}
