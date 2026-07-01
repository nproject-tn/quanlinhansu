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
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DatePickerProps = {
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

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

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
        "glass-control flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition-colors hover:text-slate-950",
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
}: DatePickerProps) {
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(startOfMonth(selectedDate));
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({
    left: 0,
    top: 0,
    width: 336,
    maxHeight: 430,
  });
  const shellRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const label = useMemo(
    () => format(selectedDate, "dd/MM/yyyy", { locale: vi }),
    [selectedDate]
  );

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  function updatePanelPlacement(actualHeight?: number) {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 10;
    const panelWidth = 336;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const spaceAbove = rect.top - viewportPadding - gap;
    const openAbove = spaceBelow < 340 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(openAbove ? spaceAbove : spaceBelow, 260);
    const measuredHeight = actualHeight ?? Math.min(maxHeight, 430);
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
    const today = new Date();
    onChange(format(today, "yyyy-MM-dd"));
    setViewDate(startOfMonth(today));
    setOpen(false);
  }

  useEffect(() => {
    setViewDate(startOfMonth(selectedDate));
  }, [selectedDate]);

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
          "glass-control flex h-10 min-w-[150px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-800 outline-none ring-blue-500 transition-[border-color,box-shadow] hover:border-slate-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-55",
          className
        )}
      >
        <span className="truncate">{label}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="month-picker-liquid month-picker-liquid-solid z-[120] rounded-[24px] border border-white/50 p-4 shadow-2xl"
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
                  <CalendarButton
                    onClick={() => setViewDate((current) => subMonths(current, 1))}
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </CalendarButton>
                  <div className="rounded-xl bg-white/65 px-4 py-2 text-sm font-semibold text-slate-800">
                    {format(viewDate, "MMMM yyyy", { locale: vi })}
                  </div>
                  <CalendarButton
                    onClick={() => setViewDate((current) => addMonths(current, 1))}
                    aria-label="Tháng sau"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </CalendarButton>
                </div>

                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-500">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="py-1">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const active = isSameDay(day, selectedDate);
                    const today = isSameDay(day, new Date());
                    const muted = !isSameMonth(day, viewDate);
                    const weekend = [5, 6].includes((day.getDay() + 6) % 7);

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => selectDate(day)}
                        className={cn(
                          "relative flex h-10 items-center justify-center rounded-xl text-sm transition-colors",
                          active
                            ? "bg-blue-600 font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.28)]"
                            : muted
                              ? "text-slate-300 hover:bg-white/55"
                              : weekend
                                ? "bg-white/35 text-slate-700 hover:bg-white/70"
                                : "text-slate-700 hover:bg-white/70",
                          today && !active ? "font-semibold text-blue-600" : ""
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/35 pt-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={selectToday}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
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
