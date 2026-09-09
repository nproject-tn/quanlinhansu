import type React from "react";

export interface DayNoteColorItem {
  key: string;
  label: string;
  swatch: string;
  isNone?: boolean;
  chipClass?: string;
  softClass?: string;
  bannerClass?: string;
  softStyle?: React.CSSProperties;
  chipStyle?: React.CSSProperties;
}

export const NONE_COLOR: DayNoteColorItem = {
  key: "none",
  label: "Không màu",
  swatch: "transparent",
  isNone: true,
  chipClass: "bg-slate-100 border-slate-200 text-slate-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300",
  softClass: "",
  bannerClass: "bg-slate-100 border-slate-200 text-slate-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300",
};

export const DAY_NOTE_COLORS: readonly DayNoteColorItem[] = [
  {
    key: "amber",
    label: "Vàng",
    swatch: "#f59e0b",
    isNone: false,
    chipClass: "bg-amber-100 border-amber-200 text-amber-900 dark:bg-amber-950/60 dark:border-amber-700/60 dark:text-amber-300",
    softClass: "bg-amber-50/70 border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-900/40",
    bannerClass: "bg-amber-100/70 border-amber-300/80 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-200",
  },
  {
    key: "rose",
    label: "Hồng",
    swatch: "#f43f5e",
    isNone: false,
    chipClass: "bg-rose-100 border-rose-200 text-rose-900 dark:bg-rose-950/60 dark:border-rose-700/60 dark:text-rose-300",
    softClass: "bg-rose-50/70 border-rose-200/70 dark:bg-rose-950/20 dark:border-rose-900/40",
    bannerClass: "bg-rose-100/70 border-rose-300/80 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800/50 dark:text-rose-200",
  },
  {
    key: "blue",
    label: "Xanh dương",
    swatch: "#3b82f6",
    isNone: false,
    chipClass: "bg-blue-100 border-blue-200 text-blue-900 dark:bg-blue-950/60 dark:border-blue-700/60 dark:text-blue-300",
    softClass: "bg-blue-50/70 border-blue-200/70 dark:bg-blue-950/20 dark:border-blue-900/40",
    bannerClass: "bg-blue-100/70 border-blue-300/80 text-blue-950 dark:bg-blue-950/40 dark:border-blue-800/50 dark:text-blue-200",
  },
  {
    key: "emerald",
    label: "Xanh lá",
    swatch: "#10b981",
    isNone: false,
    chipClass: "bg-emerald-100 border-emerald-200 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-700/60 dark:text-emerald-300",
    softClass: "bg-emerald-50/70 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-900/40",
    bannerClass: "bg-emerald-100/70 border-emerald-300/80 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-200",
  },
  {
    key: "violet",
    label: "Tím",
    swatch: "#8b5cf6",
    isNone: false,
    chipClass: "bg-violet-100 border-violet-200 text-violet-900 dark:bg-violet-950/60 dark:border-violet-700/60 dark:text-violet-300",
    softClass: "bg-violet-50/70 border-violet-200/70 dark:bg-violet-950/20 dark:border-violet-900/40",
    bannerClass: "bg-violet-100/70 border-violet-300/80 text-violet-950 dark:bg-violet-950/40 dark:border-violet-800/50 dark:text-violet-200",
  },
  {
    key: "slate",
    label: "Xám",
    swatch: "#64748b",
    isNone: false,
    chipClass: "bg-slate-100 border-slate-200 text-slate-900 dark:bg-slate-800/60 dark:border-slate-700/60 dark:text-slate-200",
    softClass: "bg-slate-100/70 border-slate-200/70 dark:bg-slate-800/20 dark:border-slate-800/40",
    bannerClass: "bg-slate-100/70 border-slate-300/80 text-slate-950 dark:bg-slate-800/40 dark:border-slate-700/50 dark:text-slate-200",
  },
] as const;

export function hexToRgba(hex: string, alpha: number): string {
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  if (cleanHex.length !== 6) {
    return `rgba(100, 116, 139, ${alpha})`;
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getDayNoteColor(colorKey?: string): DayNoteColorItem {
  if (!colorKey || colorKey === "none" || colorKey === "transparent") {
    return NONE_COLOR;
  }

  // Check preset by key
  const preset = DAY_NOTE_COLORS.find((color) => color.key === colorKey);
  if (preset) {
    return { ...preset, isNone: false };
  }

  // Check preset by swatch hex
  const presetBySwatch = DAY_NOTE_COLORS.find(
    (color) => color.swatch.toLowerCase() === colorKey.toLowerCase()
  );
  if (presetBySwatch) {
    return { ...presetBySwatch, isNone: false };
  }

  // Custom Hex Color support
  if (colorKey.startsWith("#")) {
    return {
      key: colorKey,
      label: colorKey,
      swatch: colorKey,
      isNone: false,
      chipClass: "border",
      softClass: "",
      bannerClass: "border",
      softStyle: {
        backgroundColor: hexToRgba(colorKey, 0.12),
        borderColor: hexToRgba(colorKey, 0.28),
      },
      chipStyle: {
        backgroundColor: hexToRgba(colorKey, 0.16),
        borderColor: hexToRgba(colorKey, 0.35),
        color: colorKey,
      },
    };
  }

  // Default is no color as requested by the user
  return NONE_COLOR;
}
