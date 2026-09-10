"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Pipette, X, Plus, Trash2, Check } from "lucide-react";
import { DAY_NOTE_COLORS, getDayNoteColor, NONE_COLOR } from "@/lib/day-note-colors";

const SAVED_COLORS_STORAGE_KEY = "apexflow_saved_day_note_colors";

const DEFAULT_SAVED_COLORS = [
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#64748b", // slate
];

// 12 columns x 10 rows curated iOS-style color palette grid (Image 3)
const GRID_PALETTE: string[][] = [
  // Row 0: 12 Grayscale shades
  [
    "#FFFFFF", "#EBEBF0", "#D1D1D6", "#C7C7CC",
    "#AEAEB2", "#8E8E93", "#636366", "#48484A",
    "#3A3A3C", "#2C2C2E", "#1C1C1E", "#000000"
  ],
  // Row 1: Very Dark Tones
  [
    "#0F172A", "#1E1B4B", "#312E81", "#4A044E",
    "#4C0519", "#450A0A", "#431407", "#451A03",
    "#422006", "#365314", "#14532D", "#064E3B"
  ],
  // Row 2: Dark Tones
  [
    "#1E293B", "#312E81", "#4338CA", "#701A75",
    "#831843", "#7F1D1D", "#7C2D12", "#78350F",
    "#713F12", "#3F6212", "#166534", "#065F46"
  ],
  // Row 3: Deep Medium Tones
  [
    "#334155", "#3730A3", "#4F46E5", "#86198F",
    "#9D174D", "#991B1B", "#9A3412", "#92400E",
    "#854D0E", "#4D7C0F", "#15803D", "#047857"
  ],
  // Row 4: Standard Vibrant Tones (Middle)
  [
    "#475569", "#4338CA", "#6366F1", "#A21CAF",
    "#BE185D", "#B91C1C", "#C2410C", "#B45309",
    "#A16207", "#65A30D", "#16A34A", "#059669"
  ],
  // Row 5: Bright Tones
  [
    "#64748B", "#4F46E5", "#818CF8", "#C026D3",
    "#DB2777", "#DC2626", "#EA580C", "#D97706",
    "#CA8A04", "#84CC16", "#22C55E", "#10B981"
  ],
  // Row 6: Soft Bright Tones
  [
    "#94A3B8", "#6366F1", "#A5B4FC", "#D946EF",
    "#EC4899", "#EF4444", "#F97316", "#F59E0B",
    "#EAB308", "#A3E635", "#4ADE80", "#34D399"
  ],
  // Row 7: Pastel Tones
  [
    "#CBD5E1", "#818CF8", "#C7D2FE", "#E879F9",
    "#F472B6", "#F87171", "#FB923C", "#FBBF24",
    "#FACC15", "#BEF264", "#86EFAC", "#6EE7B7"
  ],
  // Row 8: Light Pastel Tones
  [
    "#E2E8F0", "#A5B4FC", "#E0E7FF", "#F0ABFC",
    "#F9A8D4", "#FCA5A5", "#FDBA74", "#FCD34D",
    "#FDE047", "#D9F99D", "#BBF7D0", "#A7F3D0"
  ],
  // Row 9: Very Light / Tinted Tones
  [
    "#F1F5F9", "#C7D2FE", "#EEF2FF", "#F5D0FE",
    "#FBCFE8", "#FECACA", "#FED7AA", "#FDE68A",
    "#FEF08A", "#ECFCCB", "#DCFCE7", "#D1FAE5"
  ]
];

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6) return { h: 0, s: 0, l: 0.5 };
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function hexToSpectrumPos(hex: string): { x: number; y: number } {
  const { h, s, l } = hexToHsl(hex);
  const y = Math.max(2, Math.min(98, (h / 360) * 100));
  let x = 50;
  if (l >= 0.5) {
    const factor = s === 0 ? 0 : (1 - l) * 2;
    x = Math.max(2, Math.min(50, factor * 50));
  } else {
    const factor = (0.5 - l) * 2;
    x = Math.max(50, Math.min(98, 50 + factor * 50));
  }
  return { x, y };
}

interface DayNoteColorPickerProps {
  value?: string;
  onChange: (colorKey: string) => void;
  disabled?: boolean;
}

export function DayNoteColorPicker({
  value = "none",
  onChange,
  disabled = false,
}: DayNoteColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftColor, setDraftColor] = useState<string>(value);
  const [activeTab, setActiveTab] = useState<"grid" | "spectrum">("grid");
  const [savedColors, setSavedColors] = useState<string[]>(DEFAULT_SAVED_COLORS);

  // Position for popover
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Spectrum canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [spectrumCursor, setSpectrumCursor] = useState<{ x: number; y: number } | null>(null);
  const isDraggingSpectrum = useRef(false);

  // Sync draftColor with external value whenever popover opens or value changes while closed
  useEffect(() => {
    if (!isOpen) {
      setDraftColor(value);
    }
  }, [isOpen, value]);

  // Load saved colors from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(SAVED_COLORS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedColors(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save color helper
  const handleSaveColor = (colorToSave: string) => {
    if (!colorToSave || colorToSave === "none") return;
    const normalized = colorToSave.toLowerCase();
    if (savedColors.some((c) => c.toLowerCase() === normalized)) return;

    const updated = [colorToSave, ...savedColors].slice(0, 16);
    setSavedColors(updated);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SAVED_COLORS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
    }
  };

  const handleRemoveSavedColor = (colorToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedColors.filter((c) => c.toLowerCase() !== colorToRemove.toLowerCase());
    setSavedColors(updated);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SAVED_COLORS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
    }
  };

  // Color resolution: external/committed vs internal draft
  const currentCommittedObj = getDayNoteColor(value);
  const isCommittedNone = currentCommittedObj.isNone || !value || value === "none";
  const committedSwatch = isCommittedNone ? "transparent" : currentCommittedObj.swatch;

  const currentDraftObj = getDayNoteColor(draftColor);
  const isDraftNone = currentDraftObj.isNone || !draftColor || draftColor === "none";
  const draftSwatch = isDraftNone ? "transparent" : currentDraftObj.swatch;

  // Toggle & positioning
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverHeight = 425;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left < 12) left = 12;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }

    let top = rect.bottom + 8;
    if (top + popoverHeight > window.innerHeight - 12 && rect.top > popoverHeight + 12) {
      top = rect.top - popoverHeight - 8;
    }

    setPopoverCoords({ top, left });
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      setDraftColor(value);
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleCommit = () => {
    onChange(draftColor);
    setIsOpen(false);
  };

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleResizeOrScroll = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
    };
  }, [isOpen, updatePosition]);

  // Eyedropper tool
  const handleEyedropper = async () => {
    if (typeof window === "undefined") return;
    if ("EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          setDraftColor(result.sRGBHex);
        }
      } catch {
        // Canceled by user
      }
    } else {
      alert("Trình duyệt hiện tại chưa hỗ trợ bộ hút màu Eyedropper API.");
    }
  };

  // Draw spectrum gradient on canvas (Image 2)
  const drawSpectrum = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Rainbow vertical hue gradient (Top to bottom)
    const rainbowGrad = ctx.createLinearGradient(0, 0, 0, height);
    rainbowGrad.addColorStop(0, "#ff0000");
    rainbowGrad.addColorStop(0.17, "#ffff00");
    rainbowGrad.addColorStop(0.33, "#00ff00");
    rainbowGrad.addColorStop(0.5, "#00ffff");
    rainbowGrad.addColorStop(0.67, "#0000ff");
    rainbowGrad.addColorStop(0.83, "#ff00ff");
    rainbowGrad.addColorStop(1, "#ff0000");

    ctx.fillStyle = rainbowGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Horizontal white gradient from left to center
    const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
    whiteGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
    whiteGrad.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    whiteGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Horizontal black gradient from center to right
    const blackGrad = ctx.createLinearGradient(0, 0, width, 0);
    blackGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    blackGrad.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    blackGrad.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, width, height);
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === "spectrum" && canvasRef.current) {
      drawSpectrum(canvasRef.current);
    }
  }, [isOpen, activeTab, drawSpectrum]);

  // Synchronize cursor position with draft selected color
  useEffect(() => {
    if (!isOpen || isDraggingSpectrum.current) return;
    if (draftColor && draftColor !== "none") {
      const swatch = getDayNoteColor(draftColor).swatch;
      if (swatch && swatch.startsWith("#")) {
        setSpectrumCursor(hexToSpectrumPos(swatch));
      }
    } else {
      setSpectrumCursor(null);
    }
  }, [isOpen, draftColor, activeTab]);

  // Handle spectrum picking
  const pickColorFromSpectrum = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(((clientX - rect.left) / rect.width) * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(((clientY - rect.top) / rect.height) * canvas.height)));

    setSpectrumCursor({
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    });

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
    setDraftColor(hex);
  };

  const handleSpectrumPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingSpectrum.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pickColorFromSpectrum(e.clientX, e.clientY);
  };

  const handleSpectrumPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingSpectrum.current) return;
    pickColorFromSpectrum(e.clientX, e.clientY);
  };

  const handleSpectrumPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingSpectrum.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  return (
    <>
      {/* Trigger Button Matching Apple Style with Transparent Gap */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label="Chọn màu ghi chú"
        title={isCommittedNone ? "Đổi màu ghi chú (hiện không có màu)" : `Đổi màu ghi chú (${currentCommittedObj.label})`}
        className="relative flex h-[26px] w-[26px] items-center justify-center rounded-full bg-transparent transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed focus:outline-none"
      >
        {/* Outer Rainbow Spectrum Ring with Masked Center */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff0080, #ff0000)",
            WebkitMask: "radial-gradient(circle, transparent 9.75px, #ffffff 10.25px)",
            mask: "radial-gradient(circle, transparent 9.75px, #ffffff 10.25px)",
          }}
        />

        {/* Center Color Circle with Transparent Gap */}
        {isCommittedNone ? (
          <div className="relative h-[15px] w-[15px] rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-neutral-600 shadow-xs">
            <div className="absolute w-[140%] h-[1.5px] bg-red-500 -rotate-45" />
          </div>
        ) : (
          <div
            className="h-[15px] w-[15px] rounded-full border border-black/15 dark:border-white/20 shadow-xs"
            style={{ backgroundColor: committedSwatch }}
          />
        )}
      </button>

      {/* Apple-Style Color Picker Popover (Images 2 & 3) */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
              zIndex: 99999,
            }}
            className="w-[320px] max-w-[calc(100vw-24px)] rounded-[20px] border border-slate-200 bg-white dark:border-[#3A3A3C] dark:bg-[#1E1E1E] p-3 text-slate-900 dark:text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 select-none"
          >
            {/* Header: Eyedropper, Title, Close Button */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-neutral-800/80">
              <button
                type="button"
                onClick={handleEyedropper}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
                title="Lấy màu từ màn hình"
              >
                <Pipette className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100 tracking-wide">Màu</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Segmented Control Tabs (Lưới / Quang phổ) */}
            <div className="mt-2.5 flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80 dark:bg-[#2C2C2E] dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab("grid")}
                className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-all ${
                  activeTab === "grid"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-[#636366] dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                }`}
              >
                Lưới
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("spectrum")}
                className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-all ${
                  activeTab === "spectrum"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-[#636366] dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                }`}
              >
                Quang phổ
              </button>
            </div>

            {/* Tab 1: Lưới (Grid Palette - Image 3) */}
            {activeTab === "grid" && (
              <div className="mt-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden bg-slate-50 dark:bg-black/40 p-1">
                <div className="grid grid-cols-12 gap-[1.5px]">
                  {GRID_PALETTE.map((row, rIdx) =>
                    row.map((hex, cIdx) => {
                      const isSelected =
                        !isDraftNone &&
                        (draftColor.toLowerCase() === hex.toLowerCase() ||
                          currentDraftObj.swatch.toLowerCase() === hex.toLowerCase());
                      return (
                        <button
                          key={`${rIdx}-${cIdx}-${hex}`}
                          type="button"
                          onClick={() => setDraftColor(hex)}
                          className="group relative aspect-square w-full rounded-[2px] transition-transform duration-50 ease-out hover:scale-125 hover:z-10 focus:outline-none transform-gpu"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Quang phổ (Spectrum Canvas - Image 2) */}
            {activeTab === "spectrum" && (
              <div className="relative mt-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden bg-slate-50 dark:bg-black/40">
                <canvas
                  ref={(el) => {
                    canvasRef.current = el;
                    if (el) {
                      drawSpectrum(el);
                    }
                  }}
                  width={290}
                  height={180}
                  onPointerDown={handleSpectrumPointerDown}
                  onPointerMove={handleSpectrumPointerMove}
                  onPointerUp={handleSpectrumPointerUp}
                  className="block h-[180px] w-full cursor-crosshair touch-none"
                />
                {/* Draggable Circle Ring Indicator */}
                {spectrumCursor && (
                  <div
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_5px_rgba(0,0,0,0.8)]"
                    style={{
                      left: `${spectrumCursor.x}%`,
                      top: `${spectrumCursor.y}%`,
                      width: "18px",
                      height: "18px",
                    }}
                  >
                    <div className="h-full w-full rounded-full border border-black/40" />
                  </div>
                )}
              </div>
            )}

            {/* Bottom Bar (Image 2 & 3): Large Selected Color Preview, No-Color Option, Saved Colors + Add Button */}
            <div className="mt-3 flex items-center gap-2.5 pt-2 border-t border-slate-200/80 dark:border-neutral-800/80">
              {/* Large Current Color Preview Box */}
              <div
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 dark:border-neutral-700 shadow-inner overflow-hidden"
                style={{ backgroundColor: isDraftNone ? "transparent" : draftSwatch }}
                title={isDraftNone ? "Không màu" : `Màu đang chọn: ${currentDraftObj.label}`}
              >
                {isDraftNone && (
                  <div className="relative h-full w-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center">
                    <div className="absolute w-[140%] h-[2px] bg-red-500 -rotate-45" />
                    <span className="sr-only">Không màu</span>
                  </div>
                )}
              </div>

              {/* No Color & Saved Colors container */}
              <div className="flex-1 flex flex-wrap items-center gap-2 py-2 px-1.5 min-h-[44px] max-h-[76px] overflow-y-auto hover-scrollbars">
                {/* Quick No-Color Button */}
                <button
                  type="button"
                  onClick={() => setDraftColor("none")}
                  className={`relative flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border transition-all ${
                    isDraftNone
                      ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-[#1E1E1E] border-slate-400 dark:border-white"
                      : "border-slate-300 hover:border-slate-400 bg-slate-100 dark:border-neutral-700 dark:hover:border-neutral-500 dark:bg-neutral-800"
                  }`}
                  title="Không màu (trong suốt)"
                >
                  <div className="relative h-4 w-4 rounded-full bg-white dark:bg-neutral-900 overflow-hidden flex items-center justify-center border border-slate-300 dark:border-neutral-700">
                    <div className="absolute w-[140%] h-[1.5px] bg-red-500 -rotate-45" />
                  </div>
                </button>

                {/* Saved Colors list */}
                {savedColors.map((colorHex) => {
                  const isSelected =
                    !isDraftNone &&
                    (draftColor.toLowerCase() === colorHex.toLowerCase() ||
                      currentDraftObj.swatch.toLowerCase() === colorHex.toLowerCase());
                  return (
                    <div
                      key={colorHex}
                      className="group relative flex items-center justify-center"
                    >
                      <button
                        type="button"
                        onClick={() => setDraftColor(colorHex)}
                        className={`h-[26px] w-[26px] shrink-0 rounded-full border transition-transform duration-50 ease-out hover:scale-110 active:scale-95 transform-gpu ${
                          isSelected
                            ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-[#1E1E1E] border-white shadow-sm"
                            : "border-slate-300 dark:border-neutral-700"
                        }`}
                        style={{ backgroundColor: colorHex }}
                        title={colorHex}
                      />
                      {/* Optional remove on hover */}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveSavedColor(colorHex, e)}
                        className="absolute -top-1 -right-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-white group-hover:flex shadow-xs text-[9px]"
                        title="Xóa màu đã lưu"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Add/Save Current Color Button (+) */}
                <button
                  type="button"
                  onClick={() => handleSaveColor(currentDraftObj.swatch)}
                  disabled={isDraftNone}
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-white transition-all disabled:opacity-40 disabled:hover:bg-slate-100 dark:disabled:hover:bg-neutral-800 disabled:cursor-not-allowed shadow-xs"
                  title={isDraftNone ? "Chọn một màu để lưu vào danh sách yêu thích" : "Thêm vào danh sách màu yêu thích"}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Footer Action Bar: Hủy & Lưu */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-neutral-800/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 py-1.5 px-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 hover:text-slate-900 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 dark:text-neutral-300 dark:hover:text-white text-xs font-semibold transition-colors text-center"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCommit}
                className="flex-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Lưu</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
