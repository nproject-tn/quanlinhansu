export const DAY_NOTE_COLORS = [
  {
    key: "amber",
    label: "Vang",
    swatch: "#f59e0b",
    chipClass: "bg-amber-100 border-amber-200 text-amber-900 dark:bg-amber-950/60 dark:border-amber-700/60 dark:text-amber-300",
    softClass: "bg-amber-50/70 border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-900/40",
    bannerClass: "bg-amber-100/70 border-amber-300/80 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-200",
  },
  {
    key: "rose",
    label: "Hong",
    swatch: "#f43f5e",
    chipClass: "bg-rose-100 border-rose-200 text-rose-900 dark:bg-rose-950/60 dark:border-rose-700/60 dark:text-rose-300",
    softClass: "bg-rose-50/70 border-rose-200/70 dark:bg-rose-950/20 dark:border-rose-900/40",
    bannerClass: "bg-rose-100/70 border-rose-300/80 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800/50 dark:text-rose-200",
  },
  {
    key: "blue",
    label: "Xanh duong",
    swatch: "#3b82f6",
    chipClass: "bg-blue-100 border-blue-200 text-blue-900 dark:bg-blue-950/60 dark:border-blue-700/60 dark:text-blue-300",
    softClass: "bg-blue-50/70 border-blue-200/70 dark:bg-blue-950/20 dark:border-blue-900/40",
    bannerClass: "bg-blue-100/70 border-blue-300/80 text-blue-950 dark:bg-blue-950/40 dark:border-blue-800/50 dark:text-blue-200",
  },
  {
    key: "emerald",
    label: "Xanh la",
    swatch: "#10b981",
    chipClass: "bg-emerald-100 border-emerald-200 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-700/60 dark:text-emerald-300",
    softClass: "bg-emerald-50/70 border-emerald-200/70 dark:bg-emerald-950/20 dark:border-emerald-900/40",
    bannerClass: "bg-emerald-100/70 border-emerald-300/80 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-200",
  },
  {
    key: "violet",
    label: "Tim",
    swatch: "#8b5cf6",
    chipClass: "bg-violet-100 border-violet-200 text-violet-900 dark:bg-violet-950/60 dark:border-violet-700/60 dark:text-violet-300",
    softClass: "bg-violet-50/70 border-violet-200/70 dark:bg-violet-950/20 dark:border-violet-900/40",
    bannerClass: "bg-violet-100/70 border-violet-300/80 text-violet-950 dark:bg-violet-950/40 dark:border-violet-800/50 dark:text-violet-200",
  },
  {
    key: "slate",
    label: "Xam",
    swatch: "#64748b",
    chipClass: "bg-slate-100 border-slate-200 text-slate-900 dark:bg-slate-800/60 dark:border-slate-700/60 dark:text-slate-200",
    softClass: "bg-slate-100/70 border-slate-200/70 dark:bg-slate-800/20 dark:border-slate-800/40",
    bannerClass: "bg-slate-100/70 border-slate-300/80 text-slate-950 dark:bg-slate-800/40 dark:border-slate-700/50 dark:text-slate-200",
  },
] as const;

export function getDayNoteColor(colorKey?: string) {
  return DAY_NOTE_COLORS.find((color) => color.key === colorKey) ?? DAY_NOTE_COLORS[0];
}
