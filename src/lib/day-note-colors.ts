export const DAY_NOTE_COLORS = [
  {
    key: "amber",
    label: "Vang",
    swatch: "#f59e0b",
    chipClass: "bg-amber-100 border-amber-200 text-amber-900",
    softClass: "bg-amber-50/70 border-amber-200/70",
    bannerClass: "bg-amber-100/70 border-amber-300/80 text-amber-950",
  },
  {
    key: "rose",
    label: "Hong",
    swatch: "#f43f5e",
    chipClass: "bg-rose-100 border-rose-200 text-rose-900",
    softClass: "bg-rose-50/70 border-rose-200/70",
    bannerClass: "bg-rose-100/70 border-rose-300/80 text-rose-950",
  },
  {
    key: "blue",
    label: "Xanh duong",
    swatch: "#3b82f6",
    chipClass: "bg-blue-100 border-blue-200 text-blue-900",
    softClass: "bg-blue-50/70 border-blue-200/70",
    bannerClass: "bg-blue-100/70 border-blue-300/80 text-blue-950",
  },
  {
    key: "emerald",
    label: "Xanh la",
    swatch: "#10b981",
    chipClass: "bg-emerald-100 border-emerald-200 text-emerald-900",
    softClass: "bg-emerald-50/70 border-emerald-200/70",
    bannerClass: "bg-emerald-100/70 border-emerald-300/80 text-emerald-950",
  },
  {
    key: "violet",
    label: "Tim",
    swatch: "#8b5cf6",
    chipClass: "bg-violet-100 border-violet-200 text-violet-900",
    softClass: "bg-violet-50/70 border-violet-200/70",
    bannerClass: "bg-violet-100/70 border-violet-300/80 text-violet-950",
  },
  {
    key: "slate",
    label: "Xam",
    swatch: "#64748b",
    chipClass: "bg-slate-100 border-slate-200 text-slate-900",
    softClass: "bg-slate-100/70 border-slate-200/70",
    bannerClass: "bg-slate-100/70 border-slate-300/80 text-slate-950",
  },
] as const;

export function getDayNoteColor(colorKey?: string) {
  return DAY_NOTE_COLORS.find((color) => color.key === colorKey) ?? DAY_NOTE_COLORS[0];
}
