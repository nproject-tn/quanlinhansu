"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: `tháng ${index + 1}`,
}));

type MonthPickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

type PanelPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function getCurrentMonthValue() {
  const current = new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
}

function getYearFromMonth(value: string) {
  return value?.slice(0, 4) || String(new Date().getFullYear());
}

function getMonthPart(value: string) {
  return value?.slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, "0");
}

function MonthButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "glass-control flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition-colors hover:text-slate-950",
        className
      )}
      {...props}
    />
  );
}

export function MonthPicker({
  value,
  onChange,
  className,
  disabled,
  ariaLabel = "Chọn tháng",
}: MonthPickerProps) {
  const selectedYear = getYearFromMonth(value);
  const selectedMonth = getMonthPart(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({
    left: 0,
    top: 0,
    width: 300,
    maxHeight: 360,
  });
  const shellRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const label = useMemo(
    () => `tháng ${Number(selectedMonth)} năm ${selectedYear}`,
    [selectedMonth, selectedYear]
  );

  function updatePanelPlacement(actualHeight?: number) {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 10;
    const panelWidth = 300;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const spaceAbove = rect.top - viewportPadding - gap;
    const openAbove = spaceBelow < 300 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(openAbove ? spaceAbove : spaceBelow, 220);
    const measuredHeight = actualHeight ?? Math.min(maxHeight, 360);
    const top = openAbove
      ? Math.max(rect.top - measuredHeight - gap, viewportPadding)
      : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding - measuredHeight);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - viewportPadding - panelWidth)
    );

    setPanelPosition({
      left,
      top,
      width: panelWidth,
      maxHeight,
    });
  }

  function selectMonth(nextYear: string, nextMonth: string) {
    onChange(`${nextYear}-${nextMonth}`);
    setOpen(false);
  }

  function selectCurrentMonth() {
    const current = getCurrentMonthValue();
    onChange(current);
    setViewYear(getYearFromMonth(current));
    setOpen(false);
  }

  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !shellRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleWindowChange = () => updatePanelPlacement(panelRef.current?.offsetHeight);

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    updatePanelPlacement();
    const frameId = window.requestAnimationFrame(() => {
      updatePanelPlacement(panelRef.current?.offsetHeight);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, viewYear, value]);

  return (
    <div ref={shellRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          updatePanelPlacement();
          setOpen((current) => !current);
        }}
        className={cn(
          "glass-control flex h-11 min-w-[220px] items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm text-slate-800 outline-none ring-slate-900 transition-[border-color,box-shadow] hover:border-slate-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-55 dark:text-slate-100 dark:ring-slate-100 dark:hover:border-slate-500",
          className
        )}
      >
        <span className="truncate">{label}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-400" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="z-[120] rounded-[24px] border border-slate-200 bg-white p-4 shadow-2xl dark:border-[#333333] dark:bg-[#252526]"
              style={{
                position: "fixed",
                width: panelPosition.width,
                left: panelPosition.left,
                top: panelPosition.top,
              }}
            >
              <div
                className="hover-scrollbars relative z-10 overflow-y-auto"
                style={{ maxHeight: panelPosition.maxHeight }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <MonthButton
                    onClick={() => setViewYear((current) => String(Number(current) - 1))}
                    aria-label="Năm trước"
                  >
                    <ChevronLeft className="h-4 w-4 dark:text-neutral-300" />
                  </MonthButton>
                  <div className="rounded-xl bg-white/65 px-4 py-2 text-sm font-semibold text-slate-800 dark:bg-neutral-800/80 dark:text-neutral-100">
                    {viewYear}
                  </div>
                  <MonthButton
                    onClick={() => setViewYear((current) => String(Number(current) + 1))}
                    aria-label="Năm sau"
                  >
                    <ChevronRight className="h-4 w-4 dark:text-neutral-300" />
                  </MonthButton>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {MONTH_OPTIONS.map((month) => {
                    const isActive = month.value === selectedMonth && viewYear === selectedYear;

                    return (
                      <button
                        key={month.value}
                        type="button"
                        onClick={() => selectMonth(viewYear, month.value)}
                        className={cn(
                          "rounded-xl px-2 py-3 text-sm transition-colors",
                          isActive
                            ? "bg-slate-900 font-semibold text-white shadow-[0_12px_26px_rgba(15,23,42,0.28)] dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_12px_26px_rgba(0,0,0,0.6)]"
                            : "bg-white/10 text-slate-700 hover:bg-slate-900/10 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                        )}
                      >
                        {month.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/35 dark:border-neutral-800/80 pt-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={selectCurrentMonth}
                    className="text-sm font-medium text-slate-900 hover:text-slate-800 dark:text-neutral-100 dark:hover:text-white"
                  >
                    Tháng này
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
