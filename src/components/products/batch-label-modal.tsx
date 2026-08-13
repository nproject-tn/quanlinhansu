"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type BatchLabelConfig = {
  widthMm: number;
  heightMm: number;
  showBatchCode: boolean;
  showOrderDate: boolean;
  showReceivedDate: boolean;
  showManufacturer: boolean;
  showSkuText: boolean;
  printQuantity: number;
};

export type FactoryOrderForLabel = {
  id: string;
  code: string;
  batchCode: string;
  orderDate: string;
  expectedDate: string;
  receivedDate?: string | null;
  manufacturerName: string;
  productName: string;
  sku?: string | null;
  colorName?: string | null;
  sizeName?: string | null;
  orderQuantity: number;
  items?: {
    id: string;
    productName: string;
    sku?: string | null;
    colorName?: string | null;
    sizeName?: string | null;
    orderQuantity: number;
  }[];
};

type Props = {
  po: FactoryOrderForLabel | null;
  isOpen: boolean;
  onClose: () => void;
};

// Code 128B Vector SVG Barcode Generator (Scales dynamically to fit parent container)
function renderBatchBarcodeSvg(text: string) {
  if (!text) return null;

  const CODE128B_PATTERNS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232"
  ];

  const START_CODE_B = 104;
  const STOP_CODE = "2331112";

  const values: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const codeVal = text.charCodeAt(i) - 32;
    const val = codeVal >= 0 && codeVal <= 95 ? codeVal : 31;
    values.push(val);
    checksum += val * (i + 1);
  }

  const checksumVal = checksum % 103;
  values.push(checksumVal);

  let bars: { isBar: boolean; width: number }[] = [];
  const addPattern = (patternStr: string) => {
    for (let i = 0; i < patternStr.length; i++) {
      bars.push({
        isBar: i % 2 === 0,
        width: parseInt(patternStr[i], 10),
      });
    }
  };

  values.forEach((v) => addPattern(CODE128B_PATTERNS[v]));
  addPattern(STOP_CODE);

  const totalWidthUnits = bars.reduce((acc, b) => acc + b.width, 0);
  let currentX = 0;
  const svgWidth = totalWidthUnits * 1.5;
  const svgHeight = 44;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      style={{ display: "block" }}
    >
      {bars.map((b, idx) => {
        const barWidth = b.width * 1.5;
        const x = currentX;
        currentX += barWidth;
        if (!b.isBar) return null;
        return (
          <rect
            key={idx}
            x={x}
            y={0}
            width={barWidth}
            height={svgHeight}
            fill="#000000"
          />
        );
      })}
    </svg>
  );
}

export function BatchLabelPrintModal({ po, isOpen, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<BatchLabelConfig>({
    widthMm: 35,
    heightMm: 25,
    showBatchCode: true,
    showOrderDate: false,
    showReceivedDate: false,
    showManufacturer: false,
    showSkuText: true,
    printQuantity: 1,
  });

  const [widthStr, setWidthStr] = useState<string>("35");
  const [heightStr, setHeightStr] = useState<string>("25");

  // Editable custom print quantities per SKU item
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [quantityInputStrs, setQuantityInputStrs] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setWidthStr(String(config.widthMm));
  }, [config.widthMm]);

  useEffect(() => {
    setHeightStr(String(config.heightMm));
  }, [config.heightMm]);

  // Sync initial print quantities when PO or modal opens
  useEffect(() => {
    if (po && isOpen) {
      const qtyMap: Record<string, number> = {};
      const strMap: Record<string, string> = {};

      if (po.items && po.items.length > 0) {
        po.items.forEach((item) => {
          const q = item.orderQuantity || 1;
          qtyMap[item.id] = q;
          strMap[item.id] = String(q);
        });
      } else {
        const q = po.orderQuantity || 1;
        qtyMap["item-single"] = q;
        strMap["item-single"] = String(q);
      }

      setCustomQuantities(qtyMap);
      setQuantityInputStrs(strMap);
    }
  }, [po, isOpen]);

  if (!po || !isOpen) return null;

  // Prepare aggregated label items list with user-customized print quantities
  const labelItems = (po.items && po.items.length > 0)
    ? po.items.map((item) => ({
        id: item.id,
        productName: item.productName || po.productName,
        sku: item.sku || po.sku || "SKU-AUTO",
        colorName: item.colorName,
        sizeName: item.sizeName,
        orderQuantity: customQuantities[item.id] ?? item.orderQuantity ?? 1,
        defaultOrderQuantity: item.orderQuantity ?? 1,
        batchCode: po.batchCode,
        manufacturerName: po.manufacturerName,
        orderDate: po.orderDate,
        receivedDate: po.receivedDate,
      }))
    : [
        {
          id: "item-single",
          productName: po.productName,
          sku: po.sku || "SKU-AUTO",
          colorName: po.colorName,
          sizeName: po.sizeName,
          orderQuantity: customQuantities["item-single"] ?? po.orderQuantity ?? 1,
          defaultOrderQuantity: po.orderQuantity ?? 1,
          batchCode: po.batchCode,
          manufacturerName: po.manufacturerName,
          orderDate: po.orderDate,
          receivedDate: po.receivedDate,
        },
      ];

  const totalLabelsToPrint = labelItems.reduce((acc, i) => acc + (i.orderQuantity || 0), 0);

  const hasExtraInfo = config.showManufacturer || config.showOrderDate || config.showReceivedDate;
  const isSmallTag = config.widthMm < 35 || config.heightMm < 25;
  const showOvercrowdingWarning = isSmallTag && hasExtraInfo;

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const renderSingleTag = (item: (typeof labelItems)[0], keyIndex: string | number) => {
    const fullBarcodeStr = `${item.sku ? item.sku + "-" : ""}${item.batchCode}`;

    // Dynamic typography scaling based on custom mm dimensions
    const titleFontSize = config.widthMm <= 30 || config.heightMm <= 20 ? "7px" : config.widthMm >= 45 ? "10px" : "8.5px";
    const codeFontSize = config.widthMm <= 30 || config.heightMm <= 20 ? "7px" : config.widthMm >= 45 ? "10px" : "8.5px";
    const paddingMm = config.widthMm <= 30 || config.heightMm <= 20 ? "1mm" : "1.5mm";

    return (
      <div
        key={keyIndex}
        className="printable-batch-tag-item bg-white text-slate-950 font-sans border border-slate-950 flex flex-col justify-between overflow-hidden select-none box-border text-center shadow-sm shrink-0"
        style={{
          width: `${config.widthMm}mm`,
          height: `${config.heightMm}mm`,
          padding: paddingMm,
        }}
      >
        {/* Label Header */}
        <div className="border-b border-slate-900 pb-0.5 mb-0.5 leading-none shrink-0 text-center">
          <span
            className="font-semibold text-slate-900 uppercase tracking-tight truncate block max-w-full"
            style={{ fontSize: titleFontSize }}
          >
            {item.productName} {item.colorName ? `• ${item.colorName}` : ""} {item.sizeName ? `(${item.sizeName})` : ""}
          </span>
        </div>

        {/* Dynamic Vector SVG Barcode Area: Stretches perfectly inside available space */}
        <div className="my-auto flex flex-col items-center justify-center flex-1 py-0.5 min-h-0 overflow-hidden">
          <div className="w-full flex-1 min-h-[14px] flex items-center justify-center px-0.5">
            {renderBatchBarcodeSvg(fullBarcodeStr)}
          </div>
          <div
            className="font-mono font-bold tracking-tight text-center mt-0.5 text-slate-950 whitespace-nowrap leading-none shrink-0"
            style={{ fontSize: codeFontSize }}
          >
            {fullBarcodeStr}
          </div>
        </div>

        {/* Optional Footer Meta Info */}
        {hasExtraInfo && (
          <div className="text-[7px] leading-tight space-y-[1px] border-t border-slate-950/80 pt-0.5 shrink-0 text-left">
            {config.showManufacturer && (
              <div className="truncate font-semibold text-slate-900">
                NSX: {item.manufacturerName}
              </div>
            )}
            <div className="flex items-center justify-between font-mono font-bold text-[7px]">
              {config.showOrderDate && <span>OD: {item.orderDate}</span>}
              {config.showReceivedDate && <span>RC: {item.receivedDate || "Chờ QC"}</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* AGGREGATED PRINT PREVIEW MODAL */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:hidden">
        {/* Full-viewport edge-to-edge dark blur backdrop cover */}
        <div
          className="fixed inset-0 w-full h-full min-h-screen bg-slate-950/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Content Container */}
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white text-slate-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-md">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Xem trước bản in tem lô sản xuất ({po.batchCode})
                </h3>
                <p className="text-xs text-slate-500">
                  Tổng <strong>{labelItems.length}</strong> mẫu SKU • <strong>{totalLabelsToPrint.toLocaleString()}</strong> tem cần in
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handlePrint}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 text-xs h-9 shadow-md flex items-center gap-2"
              >
                <Printer className="h-4 w-4" /> In Phiếu ({totalLabelsToPrint.toLocaleString()} tem)
              </Button>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Controls & Custom Tag Size Bar */}
          <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Kích thước tem:</span>
                
                {/* Presets */}
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, widthMm: 35, heightMm: 25 }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    config.widthMm === 35 && config.heightMm === 25
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  35×25mm (Mặc định)
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, widthMm: 40, heightMm: 30 }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    config.widthMm === 40 && config.heightMm === 30
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  40×30mm
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, widthMm: 50, heightMm: 30 }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    config.widthMm === 50 && config.heightMm === 30
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  50×30mm
                </button>

                {/* Custom Size Input Box */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-xs ml-1">
                  <span className="text-[11px] text-slate-500 font-medium">Tùy chỉnh:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={widthStr}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "" || /^\d+$/.test(raw)) {
                        setWidthStr(raw);
                        if (raw !== "") {
                          const val = parseInt(raw, 10);
                          if (!isNaN(val)) {
                            setConfig((prev) => ({ ...prev, widthMm: val }));
                          }
                        }
                      }
                    }}
                    onBlur={() => {
                      const val = parseInt(widthStr, 10);
                      if (isNaN(val) || val < 10) {
                        setWidthStr("35");
                        setConfig((prev) => ({ ...prev, widthMm: 35 }));
                      }
                    }}
                    className="w-11 h-6 text-center font-mono font-bold text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    title="Chiều rộng (mm)"
                  />
                  <span className="text-slate-400 font-mono text-xs">×</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={heightStr}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "" || /^\d+$/.test(raw)) {
                        setHeightStr(raw);
                        if (raw !== "") {
                          const val = parseInt(raw, 10);
                          if (!isNaN(val)) {
                            setConfig((prev) => ({ ...prev, heightMm: val }));
                          }
                        }
                      }
                    }}
                    onBlur={() => {
                      const val = parseInt(heightStr, 10);
                      if (isNaN(val) || val < 10) {
                        setHeightStr("25");
                        setConfig((prev) => ({ ...prev, heightMm: 25 }));
                      }
                    }}
                    className="w-11 h-6 text-center font-mono font-bold text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    title="Chiều cao (mm)"
                  />
                  <span className="text-[11px] text-slate-400 font-mono">mm</span>
                </div>
              </div>
            </div>

            {/* Optional Field Checkboxes */}
            <div className="flex items-center gap-4 text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.showManufacturer}
                  onChange={(e) => setConfig((prev) => ({ ...prev, showManufacturer: e.target.checked }))}
                  className="rounded text-slate-900 focus:ring-slate-900"
                />
                <span>Hiện NSX</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.showOrderDate}
                  onChange={(e) => setConfig((prev) => ({ ...prev, showOrderDate: e.target.checked }))}
                  className="rounded text-slate-900 focus:ring-slate-900"
                />
                <span>Hiện Ngày đặt (OD)</span>
              </label>
            </div>
          </div>

          {/* Aggregated Preview Body */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
            {/* Smart Overcrowding Warning Banner */}
            {showOvercrowdingWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-3 shadow-xs animate-pulse">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h5 className="font-bold text-amber-900">Cảnh báo: Kích thước tem quá nhỏ ({config.widthMm}×{config.heightMm}mm) cho nhiều thông tin phụ</h5>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Bạn đang bật hiển thị thêm thông tin phụ (NSX, Ngày đặt...). Kích thước tem quá nhỏ có thể khiến mã vạch Barcode bị thu hẹp gây khó quét hoặc chèn dòng chữ. Vui lòng <strong>tăng kích thước tem</strong> hoặc <strong>tắt bớt thông tin phụ</strong> để tem in ra đẹp nhất!
                  </p>
                </div>
              </div>
            )}

            {/* List of aggregated label items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {labelItems.map((item, idx) => {
                const fullBarcodeStr = `${item.sku ? item.sku + "-" : ""}${item.batchCode}`;

                return (
                  <div
                    key={item.id || idx}
                    className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all shadow-sm"
                  >
                    {/* Item Header Info */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-900 font-mono text-xs font-bold border border-slate-200">
                            {fullBarcodeStr}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">({item.colorName || ""} {item.sizeName ? "• " + item.sizeName : ""})</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-1.5">{item.productName}</h4>
                      </div>

                      {/* Highlighted & Editable Total Print Quantity Input Box */}
                      <div className="bg-amber-50/90 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl text-center shrink-0 shadow-xs flex flex-col items-center justify-center">
                        <span className="text-[10px] text-amber-800 uppercase tracking-wider block font-bold">Số lượng in</span>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={quantityInputStrs[item.id] ?? String(item.orderQuantity)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "" || /^\d+$/.test(raw)) {
                                setQuantityInputStrs((prev) => ({ ...prev, [item.id]: raw }));
                                if (raw !== "") {
                                  const val = parseInt(raw, 10);
                                  if (!isNaN(val)) {
                                    setCustomQuantities((prev) => ({ ...prev, [item.id]: val }));
                                  }
                                }
                              }
                            }}
                            onBlur={() => {
                              const currentStr = quantityInputStrs[item.id];
                              const val = parseInt(currentStr || "", 10);
                              if (isNaN(val) || val <= 0) {
                                const fallback = item.defaultOrderQuantity || 1;
                                setQuantityInputStrs((prev) => ({ ...prev, [item.id]: String(fallback) }));
                                setCustomQuantities((prev) => ({ ...prev, [item.id]: fallback }));
                              }
                            }}
                            className="w-16 h-7 text-center font-mono font-black text-base text-amber-950 bg-white border border-amber-300/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                            title="Nhấp để thay đổi số lượng tem cần in"
                          />
                          <span className="text-[11px] text-amber-800 font-bold">tem</span>
                        </div>
                      </div>
                    </div>

                    {/* Physical Tag Card Visual Preview (Dynamic SVG Scaling) */}
                    <div className="flex items-center justify-center bg-slate-100/70 p-4 rounded-xl border border-slate-200/60 overflow-hidden min-h-[110px]">
                      {renderSingleTag(item, `preview-${idx}`)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white shrink-0">
            <div className="text-xs text-slate-500 font-medium">
              Kích thước tem: <strong>{config.widthMm}×{config.heightMm}mm</strong> • Lô hàng <strong>{po.batchCode}</strong> • Tổng <strong>{totalLabelsToPrint.toLocaleString()}</strong> tem cần in
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="border-slate-200 text-slate-700 hover:bg-slate-100">
                Đóng
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 shadow-md"
              >
                <Printer className="h-4 w-4 mr-2" /> In Tất Cả ({totalLabelsToPrint.toLocaleString()} Tem)
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PORTAL FOR PHYSICAL THERMAL PRINTING */}
      {mounted &&
        createPortal(
          <div id="printable-batch-portal" className="hidden print:block">
            {labelItems.flatMap((item) =>
              Array.from({ length: item.orderQuantity }).map((_, i) =>
                renderSingleTag(item, `print-${item.id}-${i}`)
              )
            )}
          </div>,
          document.body
        )}

      {/* DYNAMIC PRINT CSS STYLES FOR THERMAL PRINTER */}
      <style jsx global>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(#printable-batch-portal) {
            display: none !important;
          }
          #printable-batch-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${config.widthMm}mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .printable-batch-tag-item {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-after: always !important;
            break-after: page !important;
            width: ${config.widthMm}mm !important;
            height: ${config.heightMm}mm !important;
            margin: 0 !important;
            padding: 1.5mm !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            background-color: white !important;
          }
          @page {
            size: ${config.widthMm}mm ${config.heightMm}mm;
            margin: 0;
          }
        }
      `}</style>
    </>
  );
}
