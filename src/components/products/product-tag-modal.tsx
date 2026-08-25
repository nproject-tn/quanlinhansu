"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, X, Tag, SlidersHorizontal, RotateCcw, Check } from "lucide-react";

type ProductTagProps = {
  product: {
    id: string;
    name: string;
    brandName?: string | null;
    brandCode?: string | null;
    sku: string;
    barcode: string;
    colorName?: string | null;
    colorCode?: string | null;
    sizeName?: string | null;
    sizeCode?: string | null;
    unit: string;
    costPrice: number;
    sellingPrice: number;
    barcodeNeedsReprint?: boolean;
    category?: { name: string };
    subcategory?: { name: string };
    manufacturer?: { name: string; code: string; country?: string | null } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onPrinted?: (productId: string) => void;
};

export type TagConfig = {
  widthCm: number;
  heightCm: number;
  showQr: boolean;
  showBarcode: boolean;
  showSku: boolean;
  showName: boolean;
  showColor: boolean;
  showSize: boolean;
  showPrice: boolean;
  showMadeIn: boolean;
  showBrandSide: boolean;
  showCategorySide: boolean;
  showQcPass: boolean;
};

const DEFAULT_TAG_CONFIG: TagConfig = {
  widthCm: 3.5,
  heightCm: 6.0,
  showQr: true,
  showBarcode: true,
  showSku: true,
  showName: true,
  showColor: true,
  showSize: true,
  showPrice: true,
  showMadeIn: true,
  showBrandSide: true,
  showCategorySide: true,
  showQcPass: true,
};

// Vector SVG EAN-8 Barcode Generator
function renderEan8Svg(barcode: string) {
  if (!barcode || barcode.length !== 8) return null;

  const L_PATTERNS = [
    "0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011"
  ];
  const R_PATTERNS = [
    "1110010", "1100110", "1101100", "1000010", "1011100",
    "1001110", "1010000", "1000100", "1001000", "1110100"
  ];

  let bits = "101"; // Start guard (bits 0..2)
  for (let i = 0; i < 4; i++) {
    const d = parseInt(barcode[i], 10) || 0;
    bits += L_PATTERNS[d];
  }
  bits += "01010"; // Center guard (bits 31..35)
  for (let i = 4; i < 8; i++) {
    const d = parseInt(barcode[i], 10) || 0;
    bits += R_PATTERNS[d];
  }
  bits += "101"; // End guard (bits 64..66)

  const moduleWidth = 2.0;
  const svgWidth = bits.length * moduleWidth; // 67 * 2 = 134px
  const totalHeight = 64;
  const dataBarHeight = 50;
  const guardBarHeight = 62;

  const leftDigits = barcode.slice(0, 4);
  const rightDigits = barcode.slice(4, 8);

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${totalHeight}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      style={{ display: "block" }}
    >
      {/* Barcode Lines */}
      {bits.split("").map((bit, idx) => {
        if (bit === "0") return null;
        const isGuard = idx < 3 || (idx >= 31 && idx < 36) || idx >= 64;
        const h = isGuard ? guardBarHeight : dataBarHeight;
        return (
          <rect
            key={idx}
            x={idx * moduleWidth}
            y={0}
            width={moduleWidth}
            height={h}
            fill="#000000"
          />
        );
      })}

      {/* Left 4 Digits placed between Start Guard and Center Guard */}
      <text
        x={17 * moduleWidth}
        y={60}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="0.8"
        fill="#000000"
      >
        {leftDigits}
      </text>

      {/* Right 4 Digits placed between Center Guard and End Guard */}
      <text
        x={49 * moduleWidth}
        y={60}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="0.8"
        fill="#000000"
      >
        {rightDigits}
      </text>
    </svg>
  );
}

// Convert Country string to MADE IN ... text
function formatMadeIn(country?: string | null) {
  if (!country || !country.trim()) return "MADE IN VIETNAM";
  const raw = country.trim().toUpperCase();
  if (raw.startsWith("MADE IN")) return raw;

  const normalized = raw
    .replace(/VIỆT NAM|VIETNAM/g, "VIETNAM")
    .replace(/TRUNG QUỐC|CHINA/g, "CHINA")
    .replace(/HÀN QUỐC|KOREA/g, "KOREA")
    .replace(/NHẬT BẢN|JAPAN/g, "JAPAN")
    .replace(/THÁI LAN|THAILAND/g, "THAILAND")
    .replace(/MỸ|USA|UNITED STATES/g, "USA");

  return `MADE IN ${normalized}`;
}

export function ProductTagPrintModal({ product, isOpen, onClose, onPrinted }: ProductTagProps) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [mounted, setMounted] = useState(false);

  // Tag Customization State
  const [config, setConfig] = useState<TagConfig>(DEFAULT_TAG_CONFIG);
  const [showCustomizer, setShowCustomizer] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("product_tag_config");
      if (saved) {
        setConfig({ ...DEFAULT_TAG_CONFIG, ...JSON.parse(saved) });
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  const updateConfig = (key: keyof TagConfig, val: any) => {
    setConfig((prev) => {
      const updated = { ...prev, [key]: val };
      try {
        localStorage.setItem("product_tag_config", JSON.stringify(updated));
      } catch (e) {
        // Ignore
      }
      return updated;
    });
  };

  const resetConfig = () => {
    setConfig(DEFAULT_TAG_CONFIG);
    try {
      localStorage.setItem("product_tag_config", JSON.stringify(DEFAULT_TAG_CONFIG));
    } catch (e) {}
  };

  useEffect(() => {
    if (product) {
      const qrData = product.barcode;
      QRCode.toDataURL(
        qrData,
        {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 300,
          color: { dark: "#000000", light: "#ffffff" },
        },
        (err, url) => {
          if (!err && url) setQrUrl(url);
        }
      );
    }
  }, [product]);

  if (!product || !isOpen) return null;

  const handlePrint = async () => {
    if (product.barcodeNeedsReprint && onPrinted) {
      onPrinted(product.id);
    }
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const madeInText = formatMadeIn(product.manufacturer?.country);

  // Compute Brand Name & Brand Code Display Text
  const effectiveBrandName = (product.brandName || "").trim();
  let effectiveBrandCode = (product.brandCode || "").trim();
  if (!effectiveBrandCode && effectiveBrandName) {
    const cleanChar = effectiveBrandName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const firstLetter = cleanChar.charAt(0) || "B";
    effectiveBrandCode = `${firstLetter}01`;
  }
  const brandDisplayText = effectiveBrandName
    ? `${effectiveBrandName} ${effectiveBrandCode}`.trim().toUpperCase()
    : effectiveBrandCode;

  // Single Tag Component structure
  const renderSingleTag = (key?: number) => (
    <div
      key={key}
      className="printable-clothing-tag bg-white border-2 border-slate-900 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden relative"
      style={{
        width: `${config.widthCm}cm`,
        height: `${config.heightCm}cm`,
        padding: "1mm 1.5mm",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* 1. RIGHT SIDE MARGIN VERTICAL TEXT (Position untouched) */}
      {config.showBrandSide && brandDisplayText && (
        <div
          className="absolute right-0.5 bottom-1.5 text-[5px] font-bold text-slate-800 uppercase tracking-tighter whitespace-nowrap select-none"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            height: "140px",
            textAlign: "left",
          }}
        >
          {brandDisplayText} {brandDisplayText}
        </div>
      )}

      {/* 2. LEFT SIDE MARGIN VERTICAL TEXT (Position untouched) */}
      {config.showCategorySide && (
        <div
          className="absolute left-0.5 bottom-12 text-[4.5px] font-bold text-slate-400 uppercase tracking-tighter whitespace-nowrap select-none"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            height: "70px",
            textAlign: "left",
          }}
        >
          {product.subcategory?.name || product.category?.name || "HÀNG HOÁ"} / {product.subcategory?.name || product.category?.name || "HÀNG HOÁ"}
        </div>
      )}

      {/* 3. MAIN CONTENT INNER CONTAINER (Expanded closer to top/bottom edges & side texts) */}
      <div className="flex flex-col justify-between h-full pl-1.5 pr-1.5 py-0">
        {/* TOP HEADER */}
        {(config.showQcPass || config.showQr) && (
          <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
            <div className="flex items-center">
              {config.showQcPass && (
                <span className="border border-slate-900 rounded-md px-1 py-0.5 text-[7px] font-bold text-slate-900 uppercase tracking-tight">
                  QC PASS
                </span>
              )}
            </div>

            {config.showQr && qrUrl && (
              <img src={qrUrl} alt="QR Code" className="h-11 w-11 sm:h-12 sm:w-12 object-contain shrink-0" />
            )}
          </div>
        )}

        {/* MIDDLE PRODUCT DETAILS (Smaller refined font sizes) */}
        {(config.showSku || config.showName || config.showColor) && (
          <div className="my-0.5 space-y-[1px] text-slate-900">
            {config.showSku && (
              <div className="text-[10.5px] font-bold tracking-tight leading-none text-slate-900">
                {product.sku}
              </div>
            )}
            {config.showName && (
              <div className="text-[8.5px] font-semibold uppercase truncate leading-none text-slate-900">
                {product.name}
              </div>
            )}
            {config.showColor && (
              <div className="text-[7.5px] text-slate-600 font-medium uppercase truncate leading-none pt-0.5">
                {product.colorName ? product.colorName : "CHUẨN"}
              </div>
            )}
          </div>
        )}

        {/* BARCODE GRAPHIC SECTION (AUTO-SCALING & FULL VERTICAL/HORIZONTAL FILLING) */}
        {config.showBarcode && (
          <div className="my-0.5 w-full flex-1 min-h-[36px] flex items-stretch justify-stretch overflow-hidden">
            {renderEan8Svg(product.barcode)}
          </div>
        )}

        {/* BOTTOM SIZE & PRICE BOX */}
        {(config.showSize || config.showPrice || config.showMadeIn) && (
          <div className="border border-slate-900 rounded-lg p-0.5 bg-white text-center flex flex-col justify-between">
            {config.showSize && (
              <div className="text-[11px] font-bold text-slate-900 leading-none py-0.5">
                {product.sizeName ? product.sizeName : "FREESIZE"}
              </div>
            )}

            {(config.showPrice || config.showMadeIn) && (
              <div className="flex items-center justify-between text-[7.5px] font-bold text-slate-900 pt-0.5 border-t border-slate-200 mt-0.5 px-0.5">
                {config.showPrice ? (
                  <span className="text-emerald-700 font-bold text-[8.5px]">
                    {product.sellingPrice.toLocaleString("vi-VN")} VNĐ
                  </span>
                ) : (
                  <span />
                )}
                {config.showMadeIn ? (
                  <span className="uppercase font-semibold text-[6.5px]">
                    {madeInText}
                  </span>
                ) : (
                  <span />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const toggleItems: { key: keyof TagConfig; label: string }[] = [
    { key: "showQr", label: "Mã QR Code" },
    { key: "showBarcode", label: "Mã vạch EAN-8" },
    { key: "showSku", label: "Mã SKU sản phẩm" },
    { key: "showName", label: "Tên sản phẩm" },
    { key: "showColor", label: "Màu sắc" },
    { key: "showSize", label: "Kích thước (Size)" },
    { key: "showPrice", label: "Giá bán sản phẩm" },
    { key: "showMadeIn", label: "Xuất xứ (Made In)" },
    { key: "showBrandSide", label: "Chữ thương hiệu lề phải" },
    { key: "showCategorySide", label: "Chữ chủng loại lề trái" },
    { key: "showQcPass", label: "Huy hiệu QC PASS" },
  ];

  return (
    <>
      {/* 1. ON-SCREEN MODAL OVERLAY */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
        <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 max-h-[92vh] overflow-y-auto">
          {/* Header Modal */}
          <div className="flex items-center justify-between border-b dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Tem in sản phẩm ({config.widthCm} x {config.heightCm} cm)
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">Tự do chỉnh sửa kích thước & trường hiển thị</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowCustomizer(!showCustomizer)}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                  showCustomizer
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-slate-50 dark:bg-[#242428] hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 border-slate-200 dark:border-neutral-700"
                }`}
                title="Cấu hình thiết kế tem"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Cấu hình</span>
              </button>

              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* CUSTOMIZER PANEL */}
          {showCustomizer && (
            <div className="bg-slate-50/90 dark:bg-[#202024] border border-indigo-100 dark:border-neutral-700 rounded-2xl p-4 space-y-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between font-bold text-indigo-950 dark:text-indigo-300 border-b dark:border-neutral-700 pb-2">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Tùy chỉnh thiết kế tem
                </span>
                <button
                  type="button"
                  onClick={resetConfig}
                  className="text-[11px] text-slate-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="h-3 w-3" /> Mặc định
                </button>
              </div>

              {/* Tag Dimensions */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-neutral-200 block">Kích thước tem in (cm):</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { w: 3.5, h: 6.0, label: "3.5 x 6.0 cm (May mặc)" },
                    { w: 3.0, h: 5.0, label: "3.0 x 5.0 cm" },
                    { w: 4.0, h: 7.0, label: "4.0 x 7.0 cm" },
                    { w: 5.0, h: 8.0, label: "5.0 x 8.0 cm" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        updateConfig("widthCm", preset.w);
                        updateConfig("heightCm", preset.h);
                      }}
                      className={`p-1.5 rounded-lg border text-[11px] font-medium transition-all text-center ${
                        config.widthCm === preset.w && config.heightCm === preset.h
                          ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs"
                          : "bg-white dark:bg-[#242428] text-slate-700 dark:text-neutral-200 border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {preset.w} x {preset.h} cm
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-slate-500 dark:text-neutral-400 font-medium">Rộng:</span>
                    <input
                      type="number"
                      step={0.1}
                      min={2}
                      max={15}
                      value={config.widthCm}
                      onChange={(e) => updateConfig("widthCm", parseFloat(e.target.value) || 3.5)}
                      className="w-16 h-7 px-2 border border-slate-200 dark:border-neutral-600 rounded-md text-center font-bold bg-white dark:bg-[#18181B] dark:text-white"
                    />
                    <span className="text-slate-500 dark:text-neutral-400">cm</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-slate-500 dark:text-neutral-400 font-medium">Cao:</span>
                    <input
                      type="number"
                      step={0.1}
                      min={2}
                      max={20}
                      value={config.heightCm}
                      onChange={(e) => updateConfig("heightCm", parseFloat(e.target.value) || 6.0)}
                      className="w-16 h-7 px-2 border border-slate-200 dark:border-neutral-600 rounded-md text-center font-bold bg-white dark:bg-[#18181B] dark:text-white"
                    />
                    <span className="text-slate-500 dark:text-neutral-400">cm</span>
                  </div>
                </div>
              </div>

              {/* Elements Toggle Grid */}
              <div className="space-y-1.5 pt-2 border-t dark:border-neutral-700">
                <label className="font-bold text-slate-700 dark:text-neutral-200 block">Ẩn / Hiện các phần trên tem:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {toggleItems.map((item) => {
                    const isChecked = !!config[item.key];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => updateConfig(item.key, !isChecked)}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left text-[11px] font-medium transition-all ${
                          isChecked
                            ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-300 font-bold"
                            : "bg-white dark:bg-[#242428] border-slate-200 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 line-through"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                            isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-neutral-600 bg-white dark:bg-[#18181B]"
                          }`}
                        >
                          {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Number of Labels */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-[#202024] p-3 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs">
            <label className="font-bold text-slate-700 dark:text-neutral-200">Số lượng tem cần in:</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-8 px-2 border border-slate-200 dark:border-neutral-600 rounded-lg text-center font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#18181B]"
              />
              <span className="text-slate-500 dark:text-neutral-400 font-medium">tem</span>
            </div>
          </div>

          {/* Tag Preview Box */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-100/80 dark:bg-[#121212] rounded-2xl border border-dashed border-slate-300 dark:border-neutral-700">
            <div className="text-[11px] text-slate-400 dark:text-neutral-400 mb-2 font-mono">
              Xem trước tem ({config.widthCm} x {config.heightCm} cm):
            </div>
            {renderSingleTag()}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 border-t dark:border-neutral-800 pt-3">
            <Button variant="ghost" onClick={onClose} className="dark:text-neutral-300 dark:hover:bg-neutral-800">
              Huỷ
            </Button>

            <Button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold text-xs px-4 py-2"
            >
              <Printer className="h-4 w-4 mr-2" /> In {quantity} tem ({config.widthCm} x {config.heightCm} cm)
            </Button>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED PRINT PORTAL ATTACHED TO DOCUMENT BODY FOR PRINTING */}
      {mounted &&
        createPortal(
          <div id="printable-tag-portal" className="hidden print:block">
            {Array.from({ length: quantity }).map((_, i) => renderSingleTag(i))}
          </div>,
          document.body
        )}

      {/* Dynamic Print Style Rules */}
      <style jsx global>{`
        @media print {
          body > *:not(#printable-tag-portal) {
            display: none !important;
          }
          #printable-tag-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${config.widthCm}cm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .printable-clothing-tag {
            display: flex !important;
            position: relative !important;
            page-break-after: always !important;
            break-after: page !important;
            width: ${config.widthCm}cm !important;
            height: ${config.heightCm}cm !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            background-color: white !important;
          }
          @page {
            size: ${config.widthCm}cm ${config.heightCm}cm;
            margin: 0;
          }
        }
      `}</style>
    </>
  );
}
