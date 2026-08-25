"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
};

export type MultiSelectProps = {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  entityName?: string; // "cửa hàng" | "nhân viên" | "mục"
  className?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
};

export function MultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder = "Chọn...",
  allLabel = "Tất cả",
  entityName = "mục",
  className,
  searchPlaceholder = "Tìm kiếm...",
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(query))
    );
  }, [options, search]);

  const isAllSelected = selectedValues.length === 0;

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    onChange([]); // Empty array represents "All" by default
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Label to display on the trigger button
  const triggerLabel = React.useMemo(() => {
    if (selectedValues.length === 0) {
      return allLabel;
    }
    if (selectedValues.length === 1) {
      const found = options.find((o) => o.value === selectedValues[0]);
      return found ? found.label : allLabel;
    }
    return `${selectedValues.length} ${entityName} đã chọn`;
  }, [selectedValues, options, allLabel, entityName]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 shadow-xs transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus:ring-neutral-700",
            selectedValues.length > 0 && "border-slate-800/30 bg-slate-50/70 font-semibold text-slate-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100",
            className
          )}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <div className="flex shrink-0 items-center gap-1">
            {selectedValues.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClearAll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleClearAll(e as any);
                }}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                title="Đặt lại về Tất cả"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", open && "rotate-180")} />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-50 w-72 p-0 shadow-xl border border-slate-200 rounded-2xl bg-white overflow-hidden dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
      >
        {/* Search Bar */}
        <div className="p-2 border-b border-slate-100 bg-slate-50/50 dark:border-neutral-800 dark:bg-neutral-800/40">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-500 border-b border-slate-100 bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <button
            type="button"
            onClick={handleSelectAll}
            className={cn(
              "hover:text-slate-900 transition-colors dark:hover:text-neutral-100",
              isAllSelected ? "font-bold text-slate-900 dark:text-neutral-100" : "text-slate-500 dark:text-neutral-400"
            )}
          >
            {isAllSelected ? "✓ Đang chọn tất cả" : "Chọn tất cả"}
          </button>
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-semibold"
            >
              Bỏ chọn ({selectedValues.length})
            </button>
          )}
        </div>

        {/* Option List */}
        <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
          {/* Default "All" Option */}
          <div
            onClick={handleSelectAll}
            className={cn(
              "flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors select-none",
              isAllSelected
                ? "bg-slate-900 text-white font-semibold shadow-xs dark:bg-neutral-100 dark:text-neutral-900"
                : "text-slate-700 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  isAllSelected
                    ? "border-white bg-white text-slate-900 dark:border-neutral-900 dark:bg-neutral-900 dark:text-white"
                    : "border-slate-300 bg-white dark:border-neutral-600 dark:bg-neutral-800"
                )}
              >
                {isAllSelected && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <span className="truncate">{allLabel} (Mặc định)</span>
            </div>
            {isAllSelected && <span className="text-[10px] text-slate-200 dark:text-neutral-600">Đang bật</span>}
          </div>

          <div className="my-1 border-t border-slate-100 dark:border-neutral-800" />

          {/* Individual Options */}
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 dark:text-neutral-500">
              Không tìm thấy {entityName} phù hợp
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isChecked = selectedValues.includes(option.value);
              return (
                <div
                  key={option.value}
                  onClick={() => handleToggle(option.value)}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors select-none",
                    isChecked
                      ? "bg-slate-100 text-slate-900 font-semibold dark:bg-neutral-800 dark:text-neutral-100"
                      : "text-slate-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        isChecked
                          ? "border-slate-900 bg-slate-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                          : "border-slate-300 bg-white dark:border-neutral-600 dark:bg-neutral-800"
                      )}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="truncate">{option.label}</span>
                      {option.subLabel && (
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">
                          {option.subLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {option.badge && (
                    <span className="shrink-0 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded dark:bg-neutral-800 dark:text-neutral-400">
                      {option.badge}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
