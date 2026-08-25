"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ThemeToggleProps = {
  className?: string;
  isCollapsed?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
};

export function ThemeToggle({
  className,
  isCollapsed = false,
  align = "end",
  side,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/70 p-1 dark:bg-slate-800/70",
          className
        )}
      >
        <div className="h-5 w-5 rounded-lg bg-slate-200/50 dark:bg-slate-700/50 animate-pulse" />
      </div>
    );
  }

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ];

  const CurrentIcon =
    theme === "light"
      ? Sun
      : theme === "dark"
      ? Moon
      : Laptop;

  const currentLabel =
    theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-all duration-300 dark:text-[#9D9D9D] dark:hover:text-white dark:hover:bg-[#252526]",
            open && "bg-slate-200/50 text-slate-900 dark:bg-[#2D2D30] dark:text-white",
            className
          )}
          title={`Giao diện: ${currentLabel}`}
          aria-label="Chọn giao diện"
        >
          <CurrentIcon className="h-4.5 w-4.5 transition-transform duration-300" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={side || (isCollapsed ? "right" : "top")}
        align={align}
        sideOffset={8}
        className="w-36 p-1.5 rounded-2xl shadow-xl border border-slate-200 bg-white dark:border-[#333333] dark:bg-[#252526] dark:text-[#E0E0E0] z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <div className="flex flex-col gap-1">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = theme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all text-left w-full select-none",
                  isSelected
                    ? "bg-slate-100 text-slate-900 font-semibold shadow-xs dark:bg-[#37373D] dark:text-white"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-[#9D9D9D] dark:hover:bg-[#2D2D30] dark:hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isSelected && option.value === "light" && "text-amber-500",
                    isSelected && option.value === "dark" && "text-slate-200",
                    isSelected && option.value === "system" && "text-sky-500"
                  )}
                />
                <span className="flex-1">{option.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white shrink-0 ml-auto" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
