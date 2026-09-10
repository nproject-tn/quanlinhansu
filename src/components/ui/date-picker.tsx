"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  customLabel?: string;
  mode?: "day" | "week" | "month";
  highlightRange?: { start: string; end: string };
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  lockMonth?: boolean; // If true, chevron navigation is locked
  placeholder?: string;
};

type PanelPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const MONTH_NAMES = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

function parseDateValue(value: string) {
  const parsed = parseISO(value || format(new Date(), "yyyy-MM-dd"));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function CalendarButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors duration-75 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-20 dark:text-slate-400 dark:hover:bg-[#2D2D30] dark:hover:text-white active:scale-95",
        className
      )}
      {...props}
    />
  );
}

export function DatePicker({
  value,
  onChange,
  className,
  disabled,
  ariaLabel = "Chọn ngày",
  customLabel,
  mode,
  highlightRange,
  minDate,
  maxDate,
  lockMonth,
  placeholder = "Chọn ngày",
}: DatePickerProps) {
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => startOfMonth(selectedDate));
  const [viewMode, setViewMode] = useState<"days" | "months" | "years">("days");
  const [yearPageBase, setYearPageBase] = useState(() => Math.floor(viewDate.getFullYear() / 12) * 12);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({
    left: 0,
    top: 0,
    width: 320,
    maxHeight: 400,
  });
  const shellRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setViewMode("days");
    }
  }, [open]);

  useEffect(() => {
    setYearPageBase(Math.floor(viewDate.getFullYear() / 12) * 12);
  }, [viewDate]);

  const range = useMemo(() => {
    if (highlightRange?.start && highlightRange?.end) {
      const s = parseISO(highlightRange.start);
      const e = parseISO(highlightRange.end);
      return {
        start: new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0),
        end: new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59),
      };
    }
    if (mode === "week") {
      const s = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const e = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return {
        start: new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0),
        end: new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59),
      };
    }
    return null;
  }, [highlightRange, mode, selectedDate]);

  const label = useMemo(() => {
    if (customLabel) return customLabel;
    if (!value) return placeholder;
    return format(selectedDate, "dd/MM/yyyy");
  }, [value, selectedDate, customLabel, placeholder]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  // Navigation restrictions
  const isPrevDisabled = useMemo(() => {
    if (viewMode === "days") {
      if (lockMonth) return true;
      if (!minDate) return false;
      const prevMonthEnd = format(endOfMonth(subMonths(viewDate, 1)), "yyyy-MM-dd");
      return prevMonthEnd < minDate;
    }
    if (viewMode === "months") {
      if (!minDate) return false;
      const prevYearEnd = `${viewDate.getFullYear() - 1}-12-31`;
      return prevYearEnd < minDate;
    }
    if (viewMode === "years") {
      if (!minDate) return false;
      const prevRangeEnd = `${yearPageBase - 1}-12-31`;
      return prevRangeEnd < minDate;
    }
    return false;
  }, [viewMode, lockMonth, minDate, viewDate, yearPageBase]);

  const isNextDisabled = useMemo(() => {
    if (viewMode === "days") {
      if (lockMonth) return true;
      if (!maxDate) return false;
      const nextMonthStart = format(startOfMonth(addMonths(viewDate, 1)), "yyyy-MM-dd");
      return nextMonthStart > maxDate;
    }
    if (viewMode === "months") {
      if (!maxDate) return false;
      const nextYearStart = `${viewDate.getFullYear() + 1}-01-01`;
      return nextYearStart > maxDate;
    }
    if (viewMode === "years") {
      if (!maxDate) return false;
      const nextRangeStart = `${yearPageBase + 12}-01-01`;
      return nextRangeStart > maxDate;
    }
    return false;
  }, [viewMode, lockMonth, maxDate, viewDate, yearPageBase]);

  function handlePrev() {
    if (viewMode === "days") {
      setViewDate((current) => subMonths(current, 1));
    } else if (viewMode === "months") {
      setViewDate((current) => new Date(current.getFullYear() - 1, current.getMonth(), 1));
    } else if (viewMode === "years") {
      setYearPageBase((current) => current - 12);
    }
  }

  function handleNext() {
    if (viewMode === "days") {
      setViewDate((current) => addMonths(current, 1));
    } else if (viewMode === "months") {
      setViewDate((current) => new Date(current.getFullYear() + 1, current.getMonth(), 1));
    } else if (viewMode === "years") {
      setYearPageBase((current) => current + 12);
    }
  }

  const isTodayDisabled = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (minDate && todayStr < minDate) return true;
    if (maxDate && todayStr > maxDate) return true;
    return false;
  }, [minDate, maxDate]);

  function updatePanelPlacement(actualHeight?: number) {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 6;
    const panelWidth = 320;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const spaceAbove = rect.top - viewportPadding - gap;
    const openAbove = spaceBelow < 340 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(openAbove ? spaceAbove : spaceBelow, 260);
    const measuredHeight = actualHeight ?? Math.min(maxHeight, 400);
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

  function selectDate(nextDate: Date) {
    onChange(format(nextDate, "yyyy-MM-dd"));
    setOpen(false);
  }

  function selectToday() {
    if (isTodayDisabled) return;
    const today = new Date();
    onChange(format(today, "yyyy-MM-dd"));
    setViewDate(startOfMonth(today));
    setOpen(false);
  }

  useEffect(() => {
    if (value) {
      setViewDate(startOfMonth(parseDateValue(value)));
    }
  }, [value]);

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
  }, [open, viewDate, value]);

  return (
    <div ref={shellRef} className="relative w-full">
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
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-800 transition-all hover:border-slate-400 focus:border-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3C3C3C] dark:bg-[#1E1E1E] dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-white dark:focus:ring-white",
          className
        )}
      >
        <span className="truncate">{label}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="z-[120] rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 dark:border-[#383838] dark:bg-[#1E1E1E]/95"
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
                {/* Header: Month & Year + Chevrons */}
                <div className="mb-3 flex items-center justify-between gap-2">
                  {viewMode === "days" ? (
                    <CalendarButton
                      onClick={handlePrev}
                      disabled={isPrevDisabled}
                      aria-label="Tháng trước"
                      title="Tháng trước"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </CalendarButton>
                  ) : viewMode === "months" ? (
                    <CalendarButton
                      onClick={() => setViewMode("days")}
                      aria-label="Quay lại chọn ngày"
                      title="Quay lại chọn ngày"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </CalendarButton>
                  ) : (
                    <CalendarButton
                      onClick={() => setViewMode("months")}
                      aria-label="Quay lại chọn tháng"
                      title="Quay lại chọn tháng"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </CalendarButton>
                  )}

                  {/* Header Center Title */}
                  {viewMode === "days" ? (
                    lockMonth ? (
                      <div className="text-sm font-bold text-slate-900 dark:text-white capitalize select-none">
                        {format(viewDate, "'Tháng' MM, yyyy", { locale: vi })}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setViewMode("months")}
                        className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900 transition-colors duration-75 hover:bg-slate-100 dark:text-white dark:hover:bg-[#2D2D30] capitalize cursor-pointer"
                        title="Bấm để chọn tháng / năm"
                      >
                        <span>{format(viewDate, "'Tháng' MM, yyyy", { locale: vi })}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform duration-75" />
                      </button>
                    )
                  ) : viewMode === "months" ? (
                    <button
                      type="button"
                      onClick={() => setViewMode("years")}
                      className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900 transition-colors duration-75 hover:bg-slate-100 dark:text-white dark:hover:bg-[#2D2D30] cursor-pointer"
                      title="Bấm để chọn năm"
                    >
                      <span>Năm {viewDate.getFullYear()}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform duration-75" />
                    </button>
                  ) : (
                    <div className="text-sm font-bold text-slate-900 dark:text-white select-none">
                      {yearPageBase} – {yearPageBase + 11}
                    </div>
                  )}

                  {viewMode === "days" ? (
                    <CalendarButton
                      onClick={handleNext}
                      disabled={isNextDisabled}
                      aria-label="Tháng sau"
                      title="Tháng sau"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </CalendarButton>
                  ) : (
                    <div className="h-8 w-8 shrink-0" aria-hidden="true" />
                  )}
                </div>

                {/* View 1: Calendar Days */}
                {viewMode === "days" ? (
                  <>
                    {/* Weekday Labels */}
                    <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {WEEKDAY_LABELS.map((label, idx) => (
                        <div
                          key={label}
                          className={cn(
                            "py-1",
                            idx >= 5 ? "text-slate-400 dark:text-slate-500" : ""
                          )}
                        >
                          {label}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day) => {
                        const dayStr = format(day, "yyyy-MM-dd");
                        const isSelected = isSameDay(day, selectedDate);
                        const isInRange = range ? day >= range.start && day <= range.end : isSelected;
                        const active = isInRange;
                        const today = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, viewDate);

                        const isOutsideMin = minDate ? dayStr < minDate : false;
                        const isOutsideMax = maxDate ? dayStr > maxDate : false;
                        const isDayDisabled = !isCurrentMonth || isOutsideMin || isOutsideMax;

                        return (
                          <button
                            key={day.toISOString()}
                            type="button"
                            disabled={isDayDisabled}
                            onClick={() => !isDayDisabled && selectDate(day)}
                            className={cn(
                              "relative flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs transition-colors duration-50 ease-out select-none active:scale-95",
                              !isCurrentMonth
                                ? "opacity-15 text-slate-400 pointer-events-none"
                                : isDayDisabled
                                  ? "opacity-25 text-slate-300 dark:text-neutral-600 cursor-not-allowed select-none"
                                  : active
                                    ? "bg-slate-900 font-bold text-white shadow-md shadow-slate-900/25 dark:bg-white dark:text-slate-900 dark:shadow-white/20"
                                    : "text-slate-700 font-medium hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-200 dark:hover:bg-[#2D2D30] dark:hover:text-white",
                              today && !active && isCurrentMonth && !isDayDisabled
                                ? "font-bold ring-1 ring-slate-400/60 dark:ring-slate-500/60"
                                : ""
                            )}
                          >
                            {format(day, "d")}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : viewMode === "months" ? (
                  /* View 2: Month Grid */
                  <div className="grid grid-cols-3 gap-2 py-1">
                    {MONTH_NAMES.map((mName, idx) => {
                      const isCurrent = viewDate.getMonth() === idx;
                      const monthStart = format(new Date(viewDate.getFullYear(), idx, 1), "yyyy-MM-dd");
                      const monthEnd = format(endOfMonth(new Date(viewDate.getFullYear(), idx, 1)), "yyyy-MM-dd");
                      const isMonthDisabled =
                        (minDate && monthEnd < minDate) ||
                        (maxDate && monthStart > maxDate);

                      return (
                        <button
                          key={mName}
                          type="button"
                          disabled={Boolean(isMonthDisabled)}
                          onClick={() => {
                            if (isMonthDisabled) return;
                            setViewDate(new Date(viewDate.getFullYear(), idx, 1));
                            setViewMode("days");
                          }}
                          className={cn(
                            "flex h-10 items-center justify-center rounded-xl text-xs font-semibold transition-colors duration-50 ease-out select-none active:scale-95",
                            isMonthDisabled
                              ? "opacity-25 text-slate-300 dark:text-neutral-600 cursor-not-allowed pointer-events-none"
                              : isCurrent
                                ? "bg-slate-900 font-bold text-white shadow-md shadow-slate-900/25 dark:bg-white dark:text-slate-900"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-200 dark:hover:bg-[#2D2D30] dark:hover:text-white"
                          )}
                        >
                          {mName}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* View 3: Year Grid */
                  <div className="grid grid-cols-3 gap-2 py-1">
                    {Array.from({ length: 12 }, (_, i) => yearPageBase + i).map((year) => {
                      const isCurrent = viewDate.getFullYear() === year;
                      const yearStart = `${year}-01-01`;
                      const yearEnd = `${year}-12-31`;
                      const isYearDisabled =
                        (minDate && yearEnd < minDate) ||
                        (maxDate && yearStart > maxDate);

                      return (
                        <button
                          key={year}
                          type="button"
                          disabled={Boolean(isYearDisabled)}
                          onClick={() => {
                            if (isYearDisabled) return;
                            setViewDate(new Date(year, viewDate.getMonth(), 1));
                            setViewMode("months");
                          }}
                          className={cn(
                            "flex h-10 items-center justify-center rounded-xl text-xs font-semibold transition-colors duration-50 ease-out select-none active:scale-95",
                            isYearDisabled
                              ? "opacity-25 text-slate-300 dark:text-neutral-600 cursor-not-allowed pointer-events-none"
                              : isCurrent
                                ? "bg-slate-900 font-bold text-white shadow-md shadow-slate-900/25 dark:bg-white dark:text-slate-900"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-200 dark:hover:bg-[#2D2D30] dark:hover:text-white"
                          )}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Footer Controls */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-[#2D2D30] pt-2.5">
                  {viewMode !== "days" ? (
                    <button
                      type="button"
                      onClick={() => setViewMode("days")}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors duration-75"
                    >
                      Quay lại ngày
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors duration-75"
                    >
                      Đóng
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isTodayDisabled}
                    onClick={selectToday}
                    className="text-xs font-semibold text-slate-900 hover:underline disabled:opacity-30 disabled:pointer-events-none dark:text-white dark:hover:text-slate-200 transition-colors duration-75"
                  >
                    Hôm nay
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
