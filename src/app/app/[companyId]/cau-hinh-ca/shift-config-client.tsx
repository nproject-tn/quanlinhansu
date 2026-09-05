"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Calendar,
  Layers,
  Copy,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { useNotifications } from "@/components/notifications/notification-center";
import { getDayNoteColor, DAY_NOTE_COLORS } from "@/lib/day-note-colors";
import { DAY_NAMES, formatDateOnly, parseDateOnly, formatDateVN, cn } from "@/lib/utils";
import { calcDurationHours, getShiftContainmentError } from "@/lib/shift-utils";
import { getDateRange, getDaysInRange } from "@/lib/schedule-engine";

type Store = { id: string; name: string; logoUrl?: string; shiftsPerDay?: number };

type ShiftTemplate = {
  id: string;
  storeId: string;
  periodId?: string | null;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  sortOrder: number;
  isActive?: boolean;
};

type ShiftConfigPeriod = {
  id: string;
  companyId: string;
  storeId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  shiftCount?: number;
  shiftTemplates?: ShiftTemplate[];
  createdAt?: string;
  updatedAt?: string;
};

type StaffingOverride = {
  id: string;
  storeId: string;
  shiftTemplateId: string;
  date: string;
  requiredStaff: number;
};

type DayNote = {
  id?: string;
  date: string;
  note: string;
  colorKey: string;
};

const STAFF_OPTIONS = [0, 1, 2, 3, 4, 5];
const NOTE_COLOR_HISTORY_KEY = "day-note-color-usage";

async function readJsonSafely<T>(response: Response, fallback: T): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function readStoredColorUsage() {
  if (typeof window === "undefined") return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(NOTE_COLOR_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function StoreFilterLogo({ store }: { store?: Store }) {
  const initials = store?.name.trim().slice(0, 2).toUpperCase() || "CH";

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:bg-[#1E1E1E] dark:border-[#3C3C3C]">
      {store?.logoUrl ? (
        <img src={store.logoUrl} alt={store.name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-[#9D9D9D]">
          {initials}
        </span>
      )}
    </div>
  );
}

export default function ShiftConfigClient({
  canEdit,
  companyId,
}: {
  canEdit?: boolean;
  companyId?: string;
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [isInitialized, setIsInitialized] = useState(false);

  // Periods state
  const [periods, setPeriods] = useState<ShiftConfigPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  // Staffing and notes
  const [overrides, setOverrides] = useState<StaffingOverride[]>([]);
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);

  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Shift editing inside the active period
  const [editingShift, setEditingShift] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", startTime: "", endTime: "" });
  const [isAddingShift, setIsAddingShift] = useState(false);
  const [newShiftForm, setNewShiftForm] = useState({
    name: "Ca Mới",
    startTime: "08:00",
    endTime: "16:00",
  });

  // Modals for Periods
  const [isAddPeriodOpen, setIsAddPeriodOpen] = useState(false);
  const [isEditPeriodRangeOpen, setIsEditPeriodRangeOpen] = useState(false);

  const [addPeriodForm, setAddPeriodForm] = useState({
    name: "",
    isSingleDay: false,
    startDate: "",
    endDate: "",
    initMode: "clone" as "clone" | "default" | "empty",
    cloneFromPeriodId: "",
    initialShiftsCount: 3,
  });

  const [editPeriodRangeForm, setEditPeriodRangeForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  // Day note color pickers
  const [openColorPickerDate, setOpenColorPickerDate] = useState<string | null>(null);
  const [recentColorKeys, setRecentColorKeys] = useState<string[]>(
    DAY_NOTE_COLORS.slice(0, 4).map((color) => color.key)
  );

  const colorPickerShellRef = useRef<HTMLDivElement | null>(null);
  const configScrollRef = useRef<HTMLDivElement | null>(null);
  const configTableRef = useRef<HTMLTableElement | null>(null);
  const configScrollbarTrackRef = useRef<HTMLDivElement | null>(null);
  const configScrollbarDragStateRef = useRef<{
    pointerStartX: number;
    scrollLeftStart: number;
  } | null>(null);
  const [configContentWidth, setConfigContentWidth] = useState(0);
  const [configViewportWidth, setConfigViewportWidth] = useState(0);
  const [configScrollLeft, setConfigScrollLeft] = useState(0);

  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();

  // Month calculations
  const monthStart = useMemo(() => parseDateOnly(`${selectedMonth}-01`), [selectedMonth]);
  const monthEnd = useMemo(() => getDateRange("month", monthStart).end, [monthStart]);
  const monthDays = useMemo(() => getDaysInRange(monthStart, monthEnd), [monthEnd, monthStart]);

  // Session storage sync
  useEffect(() => {
    const store = sessionStorage.getItem("config_selectedStore");
    if (store) setSelectedStore(store);
    const month = sessionStorage.getItem("config_selectedMonth");
    if (month) setSelectedMonth(month);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      sessionStorage.setItem("config_selectedStore", selectedStore);
      sessionStorage.setItem("config_selectedMonth", selectedMonth);
    }
  }, [selectedStore, selectedMonth, isInitialized]);

  // Active period calculation
  const activePeriod = useMemo(() => {
    if (!selectedPeriodId) return periods[0] ?? null;
    return periods.find((p) => p.id === selectedPeriodId) ?? periods[0] ?? null;
  }, [periods, selectedPeriodId]);

  // Days covered by the active period
  const periodDays = useMemo(() => {
    if (!activePeriod) return [];
    try {
      const pStart = parseDateOnly(activePeriod.startDate);
      const pEnd = parseDateOnly(activePeriod.endDate);
      return getDaysInRange(pStart, pEnd);
    } catch {
      return [];
    }
  }, [activePeriod]);

  // Active shifts within the period
  const activeShifts = useMemo(() => {
    if (!activePeriod?.shiftTemplates) return [];
    return activePeriod.shiftTemplates
      .filter((s) => s.isActive !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [activePeriod]);

  // Month coverage calculation
  const { configuredDaysCount, unconfiguredDays } = useMemo(() => {
    const configured: Date[] = [];
    const unconfigured: Date[] = [];

    monthDays.forEach((day) => {
      const dateStr = formatDateOnly(day);
      const isCovered = periods.some((p) => p.startDate <= dateStr && dateStr <= p.endDate);
      if (isCovered) {
        configured.push(day);
      } else {
        unconfigured.push(day);
      }
    });

    return {
      configuredDaysCount: configured.length,
      unconfiguredDays: unconfigured,
    };
  }, [monthDays, periods]);

  // Real-time period overlap checker
  const findConflictingPeriod = useCallback(
    (startStr: string, endStr: string, excludePeriodId?: string) => {
      if (!startStr || !endStr) return null;
      return (
        periods.find((p) => {
          if (excludePeriodId && p.id === excludePeriodId) return false;
          // [A, B] overlaps with [C, D] <=> A <= D and C <= B
          return startStr <= p.endDate && p.startDate <= endStr;
        }) ?? null
      );
    },
    [periods]
  );

  const refreshColorHistory = useCallback(async () => {
    const usage = readStoredColorUsage();
    try {
      const res = await fetch("/api/schedule-day-notes");
      const data = ensureArray<DayNote>(await readJsonSafely<DayNote[]>(res, []));
      for (const item of data) {
        if (item.colorKey) {
          usage[item.colorKey] = (usage[item.colorKey] ?? 0) + 1;
        }
      }
    } catch {
      // Keep local history only when global note history is unavailable.
    }

    const topKeys = [...DAY_NOTE_COLORS]
      .sort((a, b) => (usage[b.key] ?? 0) - (usage[a.key] ?? 0))
      .slice(0, 4)
      .map((color) => color.key);

    setRecentColorKeys(topKeys);
  }, []);

  const trackColorUsage = useCallback((colorKey: string) => {
    if (typeof window === "undefined") return;

    const usage = readStoredColorUsage();
    usage[colorKey] = (usage[colorKey] ?? 0) + 1;
    window.localStorage.setItem(NOTE_COLOR_HISTORY_KEY, JSON.stringify(usage));

    const topKeys = [...DAY_NOTE_COLORS]
      .sort((a, b) => (usage[b.key] ?? 0) - (usage[a.key] ?? 0))
      .slice(0, 4)
      .map((color) => color.key);

    setRecentColorKeys(topKeys);
  }, []);

  const loadStores = useCallback(async () => {
    const res = await fetch("/api/stores?lean=1");
    const data = ensureArray<Store>(await readJsonSafely<Store[]>(res, []));
    if (!res.ok) {
      setMessage("Không tải được danh sách cửa hàng");
      setStores([]);
      return [];
    }
    setStores(data);
    return data;
  }, []);

  const loadPeriodsAndConfig = useCallback(
    async (storeId: string, month: string, preferredPeriodId?: string) => {
      if (!storeId) return;

      setLoading(true);
      try {
        const periodRes = await fetch(`/api/shift-config-periods?storeId=${storeId}&month=${month}`);
        const periodData = ensureArray<ShiftConfigPeriod>(
          await readJsonSafely<ShiftConfigPeriod[]>(periodRes, [])
        );

        setPeriods(periodData);

        // Select period
        let targetPeriod: ShiftConfigPeriod | null = null;
        if (preferredPeriodId && periodData.some((p) => p.id === preferredPeriodId)) {
          setSelectedPeriodId(preferredPeriodId);
          targetPeriod = periodData.find((p) => p.id === preferredPeriodId)!;
        } else if (selectedPeriodId && periodData.some((p) => p.id === selectedPeriodId)) {
          targetPeriod = periodData.find((p) => p.id === selectedPeriodId)!;
        } else if (periodData.length > 0) {
          setSelectedPeriodId(periodData[0].id);
          targetPeriod = periodData[0];
        } else {
          setSelectedPeriodId(null);
          setOverrides([]);
          setDayNotes([]);
        }

        if (targetPeriod) {
          const from = targetPeriod.startDate;
          const to = targetPeriod.endDate;

          const [overrideRes, dayNoteRes] = await Promise.all([
            fetch(`/api/staffing-overrides?storeId=${storeId}&from=${from}&to=${to}`),
            fetch(`/api/schedule-day-notes?from=${from}&to=${to}`),
          ]);

          const [overrideData, dayNoteData] = await Promise.all([
            readJsonSafely<
              Array<{
                id: string;
                storeId: string;
                shiftTemplateId: string;
                date: string | Date;
                requiredStaff: number;
              }>
            >(overrideRes, []),
            readJsonSafely<DayNote[]>(dayNoteRes, []),
          ]);

          setOverrides(
            ensureArray<{
              id: string;
              storeId: string;
              shiftTemplateId: string;
              date: string | Date;
              requiredStaff: number;
            }>(overrideData).map((item) => ({
              ...item,
              date:
                typeof item.date === "string" ? item.date.slice(0, 10) : formatDateOnly(item.date),
            }))
          );
          setDayNotes(ensureArray<DayNote>(dayNoteData));
        }
      } catch {
        setMessage("Không tải được cấu hình ca. Vui lòng thử tải lại trang.");
      } finally {
        setLoading(false);
      }
    },
    [selectedPeriodId]
  );

  useEffect(() => {
    loadStores().then((storeData) => {
      if (storeData.length > 0) {
        setSelectedStore((current) => current || storeData[0].id);
      }
    });
  }, [loadStores]);

  useEffect(() => {
    void refreshColorHistory();
  }, [refreshColorHistory]);

  useEffect(() => {
    if (!isInitialized || !selectedStore) return;
    void loadPeriodsAndConfig(selectedStore, selectedMonth);
  }, [loadPeriodsAndConfig, selectedMonth, selectedStore, isInitialized]);

  // When activePeriod changes without full month reload
  const loadPeriodDetails = useCallback(
    async (period: ShiftConfigPeriod) => {
      const from = period.startDate;
      const to = period.endDate;
      try {
        const [overrideRes, dayNoteRes] = await Promise.all([
          fetch(`/api/staffing-overrides?storeId=${selectedStore}&from=${from}&to=${to}`),
          fetch(`/api/schedule-day-notes?from=${from}&to=${to}`),
        ]);

        const [overrideData, dayNoteData] = await Promise.all([
          readJsonSafely<
            Array<{
              id: string;
              storeId: string;
              shiftTemplateId: string;
              date: string | Date;
              requiredStaff: number;
            }>
          >(overrideRes, []),
          readJsonSafely<DayNote[]>(dayNoteRes, []),
        ]);

        setOverrides(
          ensureArray<{
            id: string;
            storeId: string;
            shiftTemplateId: string;
            date: string | Date;
            requiredStaff: number;
          }>(overrideData).map((item) => ({
            ...item,
            date:
              typeof item.date === "string" ? item.date.slice(0, 10) : formatDateOnly(item.date),
          }))
        );
        setDayNotes(ensureArray<DayNote>(dayNoteData));
      } catch {
        // Ignored
      }
    },
    [selectedStore]
  );

  function handleSelectPeriod(periodId: string) {
    setSelectedPeriodId(periodId);
    setEditingShift(null);
    setIsAddingShift(false);
    const p = periods.find((item) => item.id === periodId);
    if (p) {
      void loadPeriodDetails(p);
    }
  }

  useEffect(() => {
    if (!message) return;
    notify({
      title: "Thông báo cấu hình ca",
      body: message,
      tone:
        message.toLowerCase().includes("không") || message.toLowerCase().includes("lỗi")
          ? "error"
          : "success",
      dedupeKey: `shift-config|${message}`,
    });
    setMessage(null);
  }, [message, notify]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!colorPickerShellRef.current?.contains(event.target as Node)) {
        setOpenColorPickerDate(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Custom horizontal scrollbar tracking
  useEffect(() => {
    const updateConfigMetrics = () => {
      setConfigContentWidth(configTableRef.current?.scrollWidth ?? 0);
      setConfigViewportWidth(configScrollRef.current?.clientWidth ?? 0);
      setConfigScrollLeft(configScrollRef.current?.scrollLeft ?? 0);
    };

    updateConfigMetrics();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => updateConfigMetrics());

    if (resizeObserver && configTableRef.current) {
      resizeObserver.observe(configTableRef.current);
    }
    if (resizeObserver && configScrollRef.current) {
      resizeObserver.observe(configScrollRef.current);
    }

    window.addEventListener("resize", updateConfigMetrics);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateConfigMetrics);
    };
  }, [periodDays.length, activeShifts.length, selectedStore, loading, activePeriod?.id]);

  useEffect(() => {
    const scroller = configScrollRef.current;
    if (!scroller) return;

    const handleScroll = () => {
      setConfigScrollLeft(scroller.scrollLeft);
      setConfigViewportWidth(scroller.clientWidth);
    };

    scroller.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, [configContentWidth]);

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (
        !configScrollbarDragStateRef.current ||
        !configScrollRef.current ||
        !configScrollbarTrackRef.current
      ) {
        return;
      }

      const trackRect = configScrollbarTrackRef.current.getBoundingClientRect();
      const maxScrollLeft = Math.max(configContentWidth - configViewportWidth, 0);
      if (maxScrollLeft <= 0) return;

      const thumbWidth = Math.max(
        (configViewportWidth / configContentWidth) * trackRect.width,
        48
      );
      const usableTrack = Math.max(trackRect.width - thumbWidth, 1);
      const deltaX = event.clientX - configScrollbarDragStateRef.current.pointerStartX;
      const scrollDelta = (deltaX / usableTrack) * maxScrollLeft;

      configScrollRef.current.scrollLeft =
        configScrollbarDragStateRef.current.scrollLeftStart + scrollDelta;
    };

    const handlePointerUp = () => {
      configScrollbarDragStateRef.current = null;
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [configContentWidth, configViewportWidth]);

  function onStoreChange(storeId: string) {
    setSelectedStore(storeId);
    setEditingShift(null);
    setIsAddingShift(false);
    setMessage(null);
  }

  function getDailyStaff(shiftId: string, dateStr: string) {
    const override = overrides.find(
      (item) =>
        item.storeId === selectedStore &&
        item.shiftTemplateId === shiftId &&
        item.date === dateStr
    );
    if (override) return override.requiredStaff;
    return 1;
  }

  function getDayNote(dateStr: string) {
    return ensureArray<DayNote>(dayNotes).find((note) => note.date === dateStr);
  }

  function hasVisibleDayNote(dateStr: string) {
    return Boolean(getDayNote(dateStr)?.note.trim());
  }

  function upsertLocalDayNote(dateStr: string, patch: Partial<DayNote>) {
    setDayNotes((items) => {
      const current = items.find((item) => item.date === dateStr) ?? {
        date: dateStr,
        note: "",
        colorKey: "amber",
      };
      const rest = items.filter((item) => item.date !== dateStr);
      const next = { ...current, ...patch };

      if (!next.note.trim() && !next.id) {
        return rest;
      }
      return [...rest, next];
    });
  }

  async function updateOverride(shiftId: string, dateStr: string, requiredStaff: number) {
    const res = await fetch("/api/staffing-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: selectedStore,
        shiftTemplateId: shiftId,
        date: dateStr,
        requiredStaff,
      }),
    });

    if (!res.ok) return;

    const saved = await readJsonSafely<{ id: string }>(res, { id: "" });
    setOverrides((current) => {
      const rest = current.filter(
        (item) =>
          !(
            item.storeId === selectedStore &&
            item.shiftTemplateId === shiftId &&
            item.date === dateStr
          )
      );
      return [
        ...rest,
        {
          id: saved.id,
          storeId: selectedStore,
          shiftTemplateId: shiftId,
          date: dateStr,
          requiredStaff,
        },
      ];
    });
    setMessage(`Đã cập nhật ngày ${format(parseDateOnly(dateStr), "dd/MM")}`);
  }

  async function applyRuleToPeriod(shiftId: string, requiredStaff: number) {
    if (!activePeriod || periodDays.length === 0) return;

    const payload = periodDays.map((day) => ({
      storeId: selectedStore,
      shiftTemplateId: shiftId,
      date: formatDateOnly(day),
      requiredStaff,
    }));

    const res = await fetch("/api/staffing-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return;

    const saved = await readJsonSafely<
      Array<{ id: string; date: string | Date; requiredStaff: number }>
    >(res, []);
    setOverrides((current) => {
      const rest = current.filter(
        (item) => !(item.storeId === selectedStore && item.shiftTemplateId === shiftId)
      );
      return [
        ...rest,
        ...(saved as Array<{ id: string; date: string | Date; requiredStaff: number }>).map(
          (item) => ({
            id: item.id,
            storeId: selectedStore,
            shiftTemplateId: shiftId,
            date: typeof item.date === "string" ? item.date.slice(0, 10) : formatDateOnly(item.date),
            requiredStaff: item.requiredStaff,
          })
        ),
      ];
    });
    setMessage(`Đã áp dụng ${requiredStaff} nhân viên cho toàn bộ đợt này`);
  }

  async function applyRuleToDay(dateStr: string, requiredStaff: number) {
    if (activeShifts.length === 0) return;

    const payload = activeShifts.map((shift) => ({
      storeId: selectedStore,
      shiftTemplateId: shift.id,
      date: dateStr,
      requiredStaff,
    }));

    const res = await fetch("/api/staffing-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return;

    const saved = await readJsonSafely<
      Array<{ id: string; date: string | Date; shiftTemplateId: string; requiredStaff: number }>
    >(res, []);
    setOverrides((current) => {
      const rest = current.filter(
        (item) => !(item.storeId === selectedStore && item.date === dateStr)
      );
      return [
        ...rest,
        ...saved.map((item) => ({
          id: item.id,
          storeId: selectedStore,
          shiftTemplateId: item.shiftTemplateId,
          date: typeof item.date === "string" ? item.date.slice(0, 10) : formatDateOnly(item.date),
          requiredStaff: item.requiredStaff,
        })),
      ];
    });
    setMessage(
      `Đã áp dụng ${requiredStaff} nhân viên cho ngày ${format(parseDateOnly(dateStr), "dd/MM")}`
    );
  }

  async function updateDayNote(dateStr: string, patch: Partial<DayNote>) {
    const current = getDayNote(dateStr) ?? {
      date: dateStr,
      note: "",
      colorKey: "amber",
    };

    const next = { ...current, ...patch };

    if (!next.note.trim()) {
      if (current.id) {
        await fetch(`/api/schedule-day-notes?date=${dateStr}`, {
          method: "DELETE",
        });
      }
      setDayNotes((items) => items.filter((item) => item.date !== dateStr));
      setMessage(`Đã xóa ghi chú ngày ${format(parseDateOnly(dateStr), "dd/MM")}`);
      return;
    }

    const res = await fetch("/api/schedule-day-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateStr,
        note: next.note.trim(),
        colorKey: next.colorKey,
      }),
    });

    if (!res.ok) return;

    const saved = await readJsonSafely<DayNote>(res, next);
    setDayNotes((items) => {
      const rest = items.filter((item) => item.date !== dateStr);
      return [...rest, saved];
    });
    trackColorUsage(saved.colorKey ?? next.colorKey);
    setMessage(`Đã cập nhật ghi chú ngày ${format(parseDateOnly(dateStr), "dd/MM")}`);
  }

  // Shift Template Actions inside Active Period
  function startEditShift(shift: ShiftTemplate) {
    setEditingShift(shift.id);
    setEditForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
  }

  async function saveEditShift(shift: ShiftTemplate) {
    for (const s of activeShifts) {
      if (s.id !== shift.id && s.isActive !== false) {
        const errorMsg = getShiftContainmentError(
          { startTime: editForm.startTime, endTime: editForm.endTime },
          s
        );
        if (errorMsg) {
          setMessage(errorMsg);
          return;
        }
      }
    }

    const durationHours = calcDurationHours(editForm.startTime, editForm.endTime);
    const res = await fetch(`/api/shift-templates/${shift.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: shift.storeId,
        periodId: shift.periodId ?? activePeriod?.id,
        name: editForm.name,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        durationHours,
        sortOrder: shift.sortOrder,
        isActive: true,
      }),
    });

    if (!res.ok) {
      const data = await readJsonSafely<{ error?: string }>(res, {});
      setMessage(data.error ?? "Lỗi cập nhật ca");
      return;
    }

    setEditingShift(null);
    await loadPeriodsAndConfig(selectedStore, selectedMonth, activePeriod?.id);
    setMessage("Đã cập nhật ca");
  }

  async function saveNewShift() {
    if (!activePeriod) {
      setMessage("Vui lòng chọn hoặc thêm bảng cấu hình ca trước.");
      return;
    }

    for (const s of activeShifts) {
      if (s.isActive !== false) {
        const errorMsg = getShiftContainmentError(
          { startTime: newShiftForm.startTime, endTime: newShiftForm.endTime },
          s
        );
        if (errorMsg) {
          setMessage(errorMsg);
          return;
        }
      }
    }

    const durationHours = calcDurationHours(newShiftForm.startTime, newShiftForm.endTime);
    const res = await fetch(`/api/shift-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: selectedStore,
        periodId: activePeriod.id,
        name: newShiftForm.name,
        startTime: newShiftForm.startTime,
        endTime: newShiftForm.endTime,
        durationHours,
        sortOrder: activeShifts.length + 1,
        isActive: true,
      }),
    });

    if (!res.ok) {
      const data = await readJsonSafely<{ error?: string }>(res, {});
      setMessage(data.error ?? "Lỗi thêm ca");
      return;
    }

    setIsAddingShift(false);
    setNewShiftForm({ name: "Ca Mới", startTime: "08:00", endTime: "16:00" });
    await loadPeriodsAndConfig(selectedStore, selectedMonth, activePeriod.id);
    setMessage("Đã thêm ca mới");
  }

  async function deleteShift(shift: ShiftTemplate) {
    const approved = await confirm({
      title: `Xóa ${shift.name}?`,
      description: "Ca này sẽ bị gỡ khỏi bảng cấu hình hiện tại.",
      confirmLabel: "Xóa ca",
      cancelLabel: "Giữ lại",
      tone: "destructive",
    });
    if (!approved) return;

    const res = await fetch(`/api/shift-templates/${shift.id}`, { method: "DELETE" });
    const data = await readJsonSafely<{ message?: string }>(res, {});
    setMessage(data.message ?? "Đã xóa");
    await loadPeriodsAndConfig(selectedStore, selectedMonth, activePeriod?.id);
  }

  // Period Modals & Actions
  function openAddPeriodModal(prefillDate?: string, cloneSourceId?: string) {
    let start = prefillDate || "";
    let end = prefillDate || "";

    if (!start) {
      if (unconfiguredDays.length > 0) {
        start = formatDateOnly(unconfiguredDays[0]);
        end = formatDateOnly(unconfiguredDays[0]);
      } else {
        start = `${selectedMonth}-01`;
        end = `${selectedMonth}-10`;
      }
    }

    setAddPeriodForm({
      name: `Đợt ${periods.length + 1} (${formatDateVN(start)} - ${formatDateVN(end)})`,
      isSingleDay: start === end,
      startDate: start,
      endDate: end,
      initMode: cloneSourceId || periods.length > 0 ? "clone" : "default",
      cloneFromPeriodId: cloneSourceId || activePeriod?.id || (periods[0]?.id ?? ""),
      initialShiftsCount: selectedStoreData?.shiftsPerDay || 3,
    });
    setIsAddPeriodOpen(true);
  }

  async function handleCreatePeriod() {
    const startStr = addPeriodForm.startDate;
    const endStr = addPeriodForm.isSingleDay ? addPeriodForm.startDate : addPeriodForm.endDate;

    if (!startStr || !endStr) {
      setMessage("Vui lòng chọn ngày bắt đầu và kết thúc");
      return;
    }

    if (startStr > endStr) {
      setMessage("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return;
    }

    const conflict = findConflictingPeriod(startStr, endStr);
    if (conflict) {
      setMessage(
        `Khoảng ngày bị trùng với bảng "${conflict.name}" (${formatDateVN(conflict.startDate)} - ${formatDateVN(conflict.endDate)}). Vui lòng chọn ngày khác.`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/shift-config-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: selectedStore,
          name: addPeriodForm.name.trim() || `Bảng ${formatDateVN(startStr)} - ${formatDateVN(endStr)}`,
          startDate: startStr,
          endDate: endStr,
          cloneFromPeriodId:
            addPeriodForm.initMode === "clone" ? addPeriodForm.cloneFromPeriodId : undefined,
          initialShiftsCount:
            addPeriodForm.initMode === "default" ? addPeriodForm.initialShiftsCount : undefined,
        }),
      });

      const data = await readJsonSafely<{ id?: string; error?: string }>(res, {});
      if (!res.ok) {
        setMessage(data.error || "Không thể tạo bảng cấu hình ca");
        return;
      }

      setIsAddPeriodOpen(false);
      await loadPeriodsAndConfig(selectedStore, selectedMonth, data.id);
      setMessage("Đã tạo bảng cấu hình ca mới thành công");
    } catch {
      setMessage("Lỗi tạo bảng cấu hình ca");
    } finally {
      setLoading(false);
    }
  }

  function openEditPeriodRangeModal() {
    if (!activePeriod) return;
    setEditPeriodRangeForm({
      name: activePeriod.name,
      startDate: activePeriod.startDate,
      endDate: activePeriod.endDate,
    });
    setIsEditPeriodRangeOpen(true);
  }

  async function handleUpdatePeriodRange() {
    if (!activePeriod) return;

    const startStr = editPeriodRangeForm.startDate;
    const endStr = editPeriodRangeForm.endDate;

    if (!startStr || !endStr) {
      setMessage("Vui lòng chọn ngày bắt đầu và kết thúc");
      return;
    }

    if (startStr > endStr) {
      setMessage("Ngày bắt đầu không được lớn hơn ngày kết thúc");
      return;
    }

    const conflict = findConflictingPeriod(startStr, endStr, activePeriod.id);
    if (conflict) {
      setMessage(
        `Khoảng ngày bị trùng với bảng "${conflict.name}" (${formatDateVN(conflict.startDate)} - ${formatDateVN(conflict.endDate)}). Vui lòng chọn ngày khác.`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/shift-config-periods/${activePeriod.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editPeriodRangeForm.name.trim() || activePeriod.name,
          startDate: startStr,
          endDate: endStr,
        }),
      });

      const data = await readJsonSafely<{ error?: string }>(res, {});
      if (!res.ok) {
        setMessage(data.error || "Không thể cập nhật khoảng ngày");
        return;
      }

      setIsEditPeriodRangeOpen(false);
      await loadPeriodsAndConfig(selectedStore, selectedMonth, activePeriod.id);
      setMessage("Đã cập nhật khoảng ngày thành công");
    } catch {
      setMessage("Lỗi cập nhật khoảng ngày");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteActivePeriod() {
    if (!activePeriod) return;

    const approved = await confirm({
      title: `Xóa bảng cấu hình "${activePeriod.name}"?`,
      description: `Bảng cấu hình ca áp dụng cho khoảng ngày ${formatDateVN(activePeriod.startDate)} - ${formatDateVN(activePeriod.endDate)} sẽ bị xóa hoàn toàn. Các ngày này sẽ trở về trạng thái trống trên Lịch xếp ca.`,
      confirmLabel: "Xóa bảng này",
      cancelLabel: "Giữ lại",
      tone: "destructive",
    });
    if (!approved) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/shift-config-periods/${activePeriod.id}`, {
        method: "DELETE",
      });
      const data = await readJsonSafely<{ message?: string; error?: string }>(res, {});
      if (!res.ok) {
        setMessage(data.error || "Lỗi xóa bảng cấu hình");
        return;
      }

      await loadPeriodsAndConfig(selectedStore, selectedMonth);
      setMessage(data.message || "Đã xóa bảng cấu hình");
    } catch {
      setMessage("Lỗi kết nối khi xóa bảng cấu hình");
    } finally {
      setLoading(false);
    }
  }

  const selectedStoreData = stores.find((store) => store.id === selectedStore);

  // Scrollbar metrics
  const hasConfigHorizontalOverflow = configContentWidth > configViewportWidth + 4;
  const configScrollbarThumbWidthPercent = hasConfigHorizontalOverflow
    ? Math.max((configViewportWidth / configContentWidth) * 100, 12)
    : 100;
  const configMaxScrollLeft = Math.max(configContentWidth - configViewportWidth, 0);
  const configScrollbarThumbOffsetPercent =
    hasConfigHorizontalOverflow && configMaxScrollLeft > 0
      ? (configScrollLeft / configMaxScrollLeft) * (100 - configScrollbarThumbWidthPercent)
      : 0;

  function handleConfigScrollbarTrackPointerDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!configScrollRef.current || !configScrollbarTrackRef.current) return;
    const trackRect = configScrollbarTrackRef.current.getBoundingClientRect();
    const clickOffset = event.clientX - trackRect.left;
    const maxScrollLeft = Math.max(configContentWidth - configViewportWidth, 0);
    if (maxScrollLeft <= 0) return;

    const thumbWidth = Math.max(
      (configViewportWidth / configContentWidth) * trackRect.width,
      48
    );
    const usableTrack = Math.max(trackRect.width - thumbWidth, 1);
    const nextScrollLeft = Math.min(
      Math.max(((clickOffset - thumbWidth / 2) / usableTrack) * maxScrollLeft, 0),
      maxScrollLeft
    );
    configScrollRef.current.scrollLeft = nextScrollLeft;
  }

  function handleConfigScrollbarThumbPointerDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!configScrollRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    configScrollbarDragStateRef.current = {
      pointerStartX: event.clientX,
      scrollLeftStart: configScrollRef.current.scrollLeft,
    };
  }

  // Conflict state for modals
  const addPeriodConflict = useMemo(() => {
    const startStr = addPeriodForm.startDate;
    const endStr = addPeriodForm.isSingleDay ? addPeriodForm.startDate : addPeriodForm.endDate;
    return findConflictingPeriod(startStr, endStr);
  }, [addPeriodForm.startDate, addPeriodForm.endDate, addPeriodForm.isSingleDay, findConflictingPeriod]);

  const editPeriodConflict = useMemo(() => {
    if (!activePeriod) return null;
    return findConflictingPeriod(
      editPeriodRangeForm.startDate,
      editPeriodRangeForm.endDate,
      activePeriod.id
    );
  }, [editPeriodRangeForm.startDate, editPeriodRangeForm.endDate, activePeriod, findConflictingPeriod]);

  return (
    <div className="space-y-6">
      {/* 1. Filter Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Bộ lọc cấu hình</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <StoreFilterLogo store={selectedStoreData} />
            <Select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="w-full sm:max-w-xs"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </div>

          <MonthPicker
            value={selectedMonth}
            onChange={setSelectedMonth}
            className="w-full sm:w-auto"
          />
        </CardContent>
      </Card>

      {/* 2. Month Coverage Summary Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-[#333333] dark:bg-[#1E1E1E]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {configuredDaysCount === monthDays.length ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            ) : configuredDaysCount > 0 ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-[#252526] dark:text-slate-400">
                <Clock className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9D9D9D]">
                Độ phủ cấu hình tháng {selectedMonth}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  Đã cấu hình {configuredDaysCount} / {monthDays.length} ngày (
                  {Math.round((configuredDaysCount / (monthDays.length || 1)) * 100)}%)
                </span>
                {configuredDaysCount === monthDays.length ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Phủ kín cả tháng
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    Còn {unconfiguredDays.length} ngày trống
                  </span>
                )}
              </div>
            </div>
          </div>

          {canEdit && unconfiguredDays.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openAddPeriodModal()}
              className="h-8 text-xs font-semibold gap-1.5 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-100 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40"
            >
              <Plus className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>+ Cấu hình ngày còn thiếu</span>
            </Button>
          )}
        </div>
      </div>

      {/* 3. Period Tabs / Selector */}
      {periods.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-[#333333]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-[#9D9D9D] mr-1">
              <Layers className="h-4 w-4" />
              <span>Các bảng cấu hình:</span>
            </div>
            {periods.map((period) => {
              const isSelected = activePeriod?.id === period.id;
              return (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => handleSelectPeriod(period.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all",
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs font-bold dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#252526] dark:text-slate-300 dark:hover:bg-[#2D2D30] font-medium"
                  )}
                >
                  <span>{period.name}</span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.5 rounded",
                      isSelected
                        ? "bg-white/20 text-white dark:bg-black/10 dark:text-slate-900"
                        : "bg-slate-200 text-slate-600 dark:bg-[#333333] dark:text-slate-400"
                    )}
                  >
                    {formatDateVN(period.startDate)} - {formatDateVN(period.endDate)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1 rounded-full",
                      isSelected
                        ? "bg-white/30 text-white dark:bg-black/20 dark:text-slate-900"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {period.shiftTemplates?.length ?? 0} ca
                  </span>
                </button>
              );
            })}
          </div>

          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openAddPeriodModal()}
              className="h-8 text-xs font-semibold gap-1 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm bảng cấu hình</span>
            </Button>
          )}
        </div>
      ) : null}

      {/* 4. Main Matrix Card OR Empty State Card */}
      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            <p className="text-sm font-medium">Đang tải cấu hình ca...</p>
          </CardContent>
        </Card>
      ) : periods.length === 0 ? (
        /* Empty State for Month (e.g. October onward if not yet configured) */
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-[#252526] mb-4">
              <Calendar className="h-7 w-7 text-slate-500 dark:text-slate-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Chưa có cấu hình ca cho tháng {selectedMonth}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md dark:text-[#9D9D9D]">
              Tháng này hiện đang trống hoàn toàn. Bạn có thể thêm nhiều bảng cấu hình ca cho 1 ngày hoặc
              khoảng nhiều ngày cụ thể (ví dụ: ngày 1-10 có 5 ca/ngày, ngày 11-20 có 3 ca/ngày...).
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
              Lưu ý: Ngày nào chưa thêm cấu hình ca thì bên Lịch xếp ca sẽ hiển thị ghi chú nhắc chuyển sang tab này.
            </p>
            {canEdit && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  onClick={() => openAddPeriodModal(`${selectedMonth}-01`)}
                  className="h-9 px-4 text-xs font-semibold gap-2 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Thêm bảng cấu hình ca mới</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : activePeriod ? (
        /* Matrix Card for Active Period */
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#333333]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base md:text-lg font-bold">
                  {activePeriod.name}
                </CardTitle>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-[#252526] dark:text-slate-300 font-mono">
                  📅 {formatDateVN(activePeriod.startDate)} - {formatDateVN(activePeriod.endDate)} (
                  {periodDays.length} ngày)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#9D9D9D]">
                Áp dụng cho {activeShifts.length} ca làm việc trong khoảng {periodDays.length} ngày này.
              </p>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openEditPeriodRangeModal}
                  title="Thay đổi khoảng ngày áp dụng"
                  className="h-8 px-2.5 text-xs font-semibold gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-500" />
                  <span>Chỉnh khoảng ngày</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAddPeriodModal(undefined, activePeriod.id)}
                  title="Sao chép danh sách ca sang đợt mới"
                  className="h-8 px-2.5 text-xs font-semibold gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Sao chép bảng</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteActivePeriod}
                  title="Xóa toàn bộ bảng cấu hình này"
                  className="h-8 px-2.5 text-xs font-semibold gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Xóa bảng</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setIsAddingShift(true);
                    if (configScrollRef.current) {
                      configScrollRef.current.scrollTop = configScrollRef.current.scrollHeight;
                    }
                  }}
                  title="Thêm ca mới vào bảng này"
                  className="h-8 px-3 text-xs font-semibold gap-1 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm ca mới</span>
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="group px-0 py-0">
            {activeShifts.length === 0 && !isAddingShift ? (
              <div className="p-8 text-center text-slate-500 space-y-3">
                <p className="text-sm font-medium">
                  Bảng cấu hình này chưa có ca làm việc nào.
                </p>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsAddingShift(true)}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Thêm ca làm việc đầu tiên</span>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="px-6">
                  <div
                    ref={configScrollRef}
                    className="hover-scrollbars max-h-[calc(100vh-16rem)] overflow-auto pt-0"
                  >
                    <table
                      ref={configTableRef}
                      className={cn(
                        "w-full min-w-max border-separate border-spacing-0 text-sm",
                        !canEdit && "pointer-events-none opacity-90"
                      )}
                    >
                      <thead>
                        <tr className="text-left">
                          <th className="h-[52px] px-2.5 sticky top-0 left-0 z-30 bg-white dark:bg-[#252526] text-slate-800 dark:text-[#E0E0E0] w-[60px] min-w-[60px] max-w-[60px] border-b border-slate-200 dark:border-[#333333] font-bold text-xs">
                            Ca
                          </th>
                          <th className="h-[52px] px-2.5 sticky top-0 left-[60px] z-30 bg-white dark:bg-[#252526] text-slate-800 dark:text-[#E0E0E0] w-[175px] min-w-[175px] max-w-[175px] border-r border-b border-slate-200 dark:border-[#333333] font-bold text-xs">
                            Giờ & Thao tác
                          </th>
                          {periodDays.map((day) => (
                            <th
                              key={formatDateOnly(day)}
                              className={cn(
                                "h-[52px] px-1 text-center text-slate-800 dark:text-[#E0E0E0] sticky top-0 z-20 bg-white dark:bg-[#252526] border-b border-slate-200 dark:border-[#333333]",
                                hasVisibleDayNote(formatDateOnly(day))
                                  ? getDayNoteColor(getDayNote(formatDateOnly(day))?.colorKey)
                                      .softClass
                                  : ""
                              )}
                            >
                              <div>{day.getUTCDate()}</div>
                              <div className="text-[11px] font-normal text-slate-500 dark:text-[#9D9D9D]">
                                {DAY_NAMES[day.getUTCDay()].replace("Thứ ", "T")}
                              </div>
                            </th>
                          ))}
                        </tr>

                        <tr className="align-top">
                          <th className="py-2.5 px-2.5 sticky top-[52px] left-0 z-30 bg-slate-50 dark:bg-[#252526] w-[60px] min-w-[60px] max-w-[60px] border-b border-slate-200 dark:border-[#333333]" />
                          <th className="py-2.5 px-2.5 text-xs font-medium text-slate-600 dark:text-[#9D9D9D] sticky top-[52px] left-[60px] z-30 bg-slate-50 dark:bg-[#252526] w-[175px] min-w-[175px] max-w-[175px] border-r border-b border-slate-200 dark:border-[#333333]">
                            Ghi chú ngày
                          </th>
                          {periodDays.map((day) => {
                            const dateStr = formatDateOnly(day);
                            const note = getDayNote(dateStr);
                            const color = getDayNoteColor(note?.colorKey);
                            return (
                              <th
                                key={`note-${dateStr}`}
                                className={cn(
                                  "px-1 py-2.5 sticky top-[52px] z-10 bg-slate-50 dark:bg-[#1E1E1E] border-b border-slate-200 dark:border-[#333333]",
                                  note?.note.trim() ? color.softClass : ""
                                )}
                              >
                                <div
                                  ref={openColorPickerDate === dateStr ? colorPickerShellRef : null}
                                  className="relative space-y-2"
                                >
                                  <div className="relative">
                                    <Input
                                      value={note?.note ?? ""}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        upsertLocalDayNote(dateStr, {
                                          note: value,
                                          colorKey: note?.colorKey ?? "amber",
                                        });
                                      }}
                                      onBlur={(e) =>
                                        updateDayNote(dateStr, { note: e.target.value })
                                      }
                                      placeholder="Ghi chú"
                                      className="h-8 min-w-[120px] pr-10 text-xs disabled:opacity-100 disabled:text-slate-800 dark:disabled:text-[#E0E0E0]"
                                      disabled={!canEdit}
                                    />
                                    <button
                                      type="button"
                                      aria-label="Chon mau"
                                      className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 rounded-md border border-slate-300 shadow-sm transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed dark:border-[#3C3C3C]"
                                      style={{ backgroundColor: color.swatch }}
                                      onClick={() =>
                                        setOpenColorPickerDate((current) =>
                                          current === dateStr ? null : dateStr
                                        )
                                      }
                                      disabled={!canEdit}
                                    />
                                  </div>

                                  {openColorPickerDate === dateStr && (
                                    <div className="absolute left-1/2 top-10 z-20 w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-[#333333] dark:bg-[#252526]">
                                      <p className="text-[11px] font-medium text-slate-500 dark:text-[#9D9D9D]">
                                        Bảng màu
                                      </p>
                                      <div className="mt-2 grid grid-cols-3 gap-2">
                                        {DAY_NOTE_COLORS.map((option) => (
                                          <button
                                            key={option.key}
                                            type="button"
                                            className={cn(
                                              "h-8 rounded-lg border",
                                              option.key === (note?.colorKey ?? "amber")
                                                ? "border-slate-900 ring-2 ring-slate-300 dark:border-white dark:ring-neutral-500"
                                                : "border-slate-200 dark:border-[#3C3C3C]"
                                            )}
                                            style={{ backgroundColor: option.swatch }}
                                            onClick={() => {
                                              upsertLocalDayNote(dateStr, { colorKey: option.key });
                                              setOpenColorPickerDate(null);
                                              if (note?.note.trim()) {
                                                void updateDayNote(dateStr, {
                                                  colorKey: option.key,
                                                });
                                              }
                                            }}
                                            aria-label={option.label}
                                          />
                                        ))}
                                      </div>
                                      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-[#333333]">
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-[#9D9D9D]">
                                          Gần đây
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {recentColorKeys.map((colorKey) => {
                                            const recentColor = getDayNoteColor(colorKey);
                                            return (
                                              <button
                                                key={`${dateStr}-${colorKey}`}
                                                type="button"
                                                className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700"
                                                style={{ backgroundColor: recentColor.swatch }}
                                                onClick={() => {
                                                  upsertLocalDayNote(dateStr, { colorKey });
                                                  setOpenColorPickerDate(null);
                                                  if (note?.note.trim()) {
                                                    void updateDayNote(dateStr, { colorKey });
                                                  }
                                                }}
                                                aria-label={`Mau ${recentColor.label}`}
                                              />
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {canEdit && (
                                    <Select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          void applyRuleToDay(dateStr, Number(e.target.value));
                                        }
                                      }}
                                      className="h-8 w-full text-xs"
                                    >
                                      <option value="">Áp dụng cả ngày</option>
                                      {STAFF_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {option} Nhân viên
                                        </option>
                                      ))}
                                    </Select>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>

                      <tbody>
                        {activeShifts.map((shift) => (
                          <tr key={shift.id} className="align-top">
                            <td className="py-2.5 px-2.5 font-bold sticky left-0 z-10 bg-white dark:bg-[#252526] text-slate-800 dark:text-[#E0E0E0] w-[60px] min-w-[60px] max-w-[60px] border-b border-slate-100 dark:border-[#333333]/80 text-xs">
                              {editingShift === shift.id ? (
                                <div className="h-7 flex items-center">
                                  <Input
                                    value={editForm.name}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, name: e.target.value })
                                    }
                                    className="h-7 w-12 px-1 text-xs font-bold"
                                  />
                                </div>
                              ) : (
                                <div className="h-6 flex items-center">
                                  <span>{shift.name}</span>
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-2.5 sticky left-[60px] z-10 bg-white dark:bg-[#252526] text-slate-700 dark:text-[#CCCCCC] w-[175px] min-w-[175px] max-w-[175px] border-r border-b border-slate-200 dark:border-[#333333] dark:border-b-[#333333]/80">
                              {editingShift === shift.id ? (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-1 h-7">
                                    <Input
                                      type="time"
                                      value={editForm.startTime}
                                      onChange={(e) =>
                                        setEditForm({ ...editForm, startTime: e.target.value })
                                      }
                                      className="h-7 w-[64px] px-1 text-xs"
                                    />
                                    <span className="text-xs text-slate-400">-</span>
                                    <Input
                                      type="time"
                                      value={editForm.endTime}
                                      onChange={(e) =>
                                        setEditForm({ ...editForm, endTime: e.target.value })
                                      }
                                      className="h-7 w-[64px] px-1 text-xs"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      ({calcDurationHours(editForm.startTime, editForm.endTime)}h)
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        title="Lưu ca"
                                        onClick={() => saveEditShift(shift)}
                                        className="h-6 w-6 rounded flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        title="Hủy"
                                        onClick={() => setEditingShift(null)}
                                        className="h-6 w-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-[#333] dark:text-slate-300 transition-colors"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between gap-1 h-6">
                                    <span className="font-semibold text-xs text-slate-800 dark:text-[#E0E0E0] whitespace-nowrap">
                                      {shift.startTime}-{shift.endTime}{" "}
                                      <span className="text-[11px] font-normal text-slate-500 dark:text-[#9D9D9D]">
                                        ({shift.durationHours}h)
                                      </span>
                                    </span>
                                    {canEdit && (
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <button
                                          type="button"
                                          title="Sửa ca"
                                          onClick={() => startEditShift(shift)}
                                          className="h-6 w-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-[#3C3C3C] transition-colors"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          title="Xóa ca"
                                          onClick={() => deleteShift(shift)}
                                          className="h-6 w-6 rounded-md flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {canEdit && (
                                    <Select
                                      className="h-6.5 text-[11px] px-1.5 py-0 w-full bg-white/70 dark:bg-[#2D2D30] border-slate-200 dark:border-[#3C3C3C]"
                                      value=""
                                      onChange={(e) =>
                                        e.target.value &&
                                        applyRuleToPeriod(shift.id, Number(e.target.value))
                                      }
                                    >
                                      <option value="">Áp dụng cả đợt</option>
                                      {STAFF_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {option} NV / ngày
                                        </option>
                                      ))}
                                    </Select>
                                  )}
                                </div>
                              )}
                            </td>

                            {periodDays.map((day) => {
                              const dateStr = formatDateOnly(day);
                              return (
                                <td
                                  key={`${shift.id}-${dateStr}`}
                                  className={cn(
                                    "px-1 py-2 text-center align-middle border-b border-slate-100 dark:border-[#333333]/80",
                                    hasVisibleDayNote(dateStr)
                                      ? getDayNoteColor(getDayNote(dateStr)?.colorKey).softClass
                                      : ""
                                  )}
                                >
                                  <Select
                                    value={String(getDailyStaff(shift.id, dateStr))}
                                    onChange={(e) =>
                                      updateOverride(shift.id, dateStr, Number(e.target.value))
                                    }
                                    className="h-8 w-[125px] text-xs disabled:opacity-100 disabled:text-slate-800 dark:disabled:text-[#E0E0E0]"
                                    disabled={!canEdit}
                                  >
                                    {STAFF_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option} Nhân viên
                                      </option>
                                    ))}
                                  </Select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* Inline Row for Adding New Shift */}
                        {isAddingShift && (
                          <tr className="border-b border-slate-100 dark:border-[#333333] align-top bg-slate-50 dark:bg-[#1E1E1E]">
                            <td className="py-2.5 px-2.5 font-bold sticky left-0 z-20 bg-slate-50 dark:bg-[#1E1E1E] text-slate-800 dark:text-[#E0E0E0] w-[60px] min-w-[60px] max-w-[60px]">
                              <div className="h-7 flex items-center">
                                <Input
                                  value={newShiftForm.name}
                                  onChange={(e) =>
                                    setNewShiftForm({ ...newShiftForm, name: e.target.value })
                                  }
                                  className="h-7 w-12 px-1 text-xs font-bold"
                                  placeholder="Tên"
                                />
                              </div>
                            </td>

                            <td className="py-2.5 px-2.5 sticky left-[60px] z-20 bg-slate-50 dark:bg-[#1E1E1E] w-[175px] min-w-[175px] max-w-[175px] border-r border-slate-200 dark:border-[#333333]">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="time"
                                    value={newShiftForm.startTime}
                                    onChange={(e) =>
                                      setNewShiftForm({
                                        ...newShiftForm,
                                        startTime: e.target.value,
                                      })
                                    }
                                    className="h-7 w-[64px] px-1 text-xs"
                                  />
                                  <span className="text-xs text-slate-400">-</span>
                                  <Input
                                    type="time"
                                    value={newShiftForm.endTime}
                                    onChange={(e) =>
                                      setNewShiftForm({ ...newShiftForm, endTime: e.target.value })
                                    }
                                    className="h-7 w-[64px] px-1 text-xs"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    (
                                    {calcDurationHours(
                                      newShiftForm.startTime,
                                      newShiftForm.endTime
                                    )}
                                    h)
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      title="Lưu ca"
                                      onClick={saveNewShift}
                                      className="h-6 px-2 rounded flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold gap-1 transition-colors"
                                    >
                                      <Check className="h-3 w-3" /> Lưu
                                    </button>
                                    <button
                                      type="button"
                                      title="Hủy"
                                      onClick={() => setIsAddingShift(false)}
                                      className="h-6 px-2 rounded flex items-center justify-center bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold gap-1 transition-colors"
                                    >
                                      <X className="h-3 w-3" /> Hủy
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td colSpan={periodDays.length}></td>
                          </tr>
                        )}

                        {!isAddingShift && canEdit && (
                          <tr>
                            <td
                              className="py-3 sticky left-0 z-20 bg-white dark:bg-[#252526]"
                              colSpan={2}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAddingShift(true)}
                                className="h-8 text-xs font-semibold"
                              >
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Thêm ca mới
                              </Button>
                            </td>
                            <td colSpan={periodDays.length}></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="px-6 pb-4 pt-2">
                  <div
                    ref={configScrollbarTrackRef}
                    onMouseDown={handleConfigScrollbarTrackPointerDown}
                    className={`relative h-2 rounded-full bg-slate-200/70 dark:bg-[#2D2D30] opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${
                      hasConfigHorizontalOverflow ? "cursor-pointer" : "pointer-events-none"
                    }`}
                  >
                    <div
                      onMouseDown={handleConfigScrollbarThumbPointerDown}
                      className={`absolute top-0 h-2 rounded-full bg-slate-500/70 dark:bg-[#45454C] shadow-sm transition-colors ${
                        hasConfigHorizontalOverflow
                          ? "cursor-grab hover:bg-slate-600/80 dark:hover:bg-[#585860] active:cursor-grabbing"
                          : "hidden"
                      }`}
                      style={{
                        width: `${configScrollbarThumbWidthPercent}%`,
                        left: `${configScrollbarThumbOffsetPercent}%`,
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* 5. Modal: Add New Period */}
      {isAddPeriodOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#3C3C3C] dark:bg-[#1E1E1E]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#333333]">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-slate-800 dark:text-white" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Thêm bảng cấu hình ca mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPeriodOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#2D2D30]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tên bảng cấu hình ca
                </label>
                <Input
                  value={addPeriodForm.name}
                  onChange={(e) =>
                    setAddPeriodForm({ ...addPeriodForm, name: e.target.value })
                  }
                  placeholder="Ví dụ: Đợt 1 (01 - 10), Cuối tuần..."
                  className="mt-1 text-xs"
                />
              </div>

              {/* Mode Selection: Single Day or Date Range */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phạm vi áp dụng
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAddPeriodForm({
                        ...addPeriodForm,
                        isSingleDay: false,
                      })
                    }
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all",
                      !addPeriodForm.isSingleDay
                        ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 shadow-xs"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#3C3C3C] dark:bg-[#252526] dark:text-slate-300"
                    )}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Khoảng nhiều ngày</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAddPeriodForm({
                        ...addPeriodForm,
                        isSingleDay: true,
                        endDate: addPeriodForm.startDate,
                      })
                    }
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all",
                      addPeriodForm.isSingleDay
                        ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900 shadow-xs"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#3C3C3C] dark:bg-[#252526] dark:text-slate-300"
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>1 ngày duy nhất</span>
                  </button>
                </div>
              </div>

              {/* Date Inputs */}
              {addPeriodForm.isSingleDay ? (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Chọn ngày áp dụng
                  </label>
                  <Input
                    type="date"
                    value={addPeriodForm.startDate}
                    onChange={(e) =>
                      setAddPeriodForm({
                        ...addPeriodForm,
                        startDate: e.target.value,
                        endDate: e.target.value,
                      })
                    }
                    className="mt-1 text-xs"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Từ ngày
                    </label>
                    <Input
                      type="date"
                      value={addPeriodForm.startDate}
                      onChange={(e) =>
                        setAddPeriodForm({
                          ...addPeriodForm,
                          startDate: e.target.value,
                        })
                      }
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Đến ngày
                    </label>
                    <Input
                      type="date"
                      value={addPeriodForm.endDate}
                      onChange={(e) =>
                        setAddPeriodForm({
                          ...addPeriodForm,
                          endDate: e.target.value,
                        })
                      }
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Real-time Overlap Conflict Notice */}
              {addPeriodConflict && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Không thể thêm do trùng ngày:</p>
                    <p>
                      Khoảng ngày này bị trùng với bảng <strong>&quot;{addPeriodConflict.name}&quot;</strong> (
                      {formatDateVN(addPeriodConflict.startDate)} - {formatDateVN(addPeriodConflict.endDate)}).
                    </p>
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      Mỗi ngày trong cửa hàng chỉ thuộc duy nhất một bảng cấu hình ca.
                    </p>
                  </div>
                </div>
              )}

              {/* Shift Initialization Options */}
              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-[#333333]">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Khởi tạo ca làm việc
                </label>
                <div className="space-y-2">
                  {periods.length > 0 && (
                    <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252526] cursor-pointer">
                      <input
                        type="radio"
                        name="initMode"
                        checked={addPeriodForm.initMode === "clone"}
                        onChange={() =>
                          setAddPeriodForm({ ...addPeriodForm, initMode: "clone" })
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-white">
                          Sao chép ca từ bảng khác
                        </span>
                        {addPeriodForm.initMode === "clone" && (
                          <Select
                            value={addPeriodForm.cloneFromPeriodId}
                            onChange={(e) =>
                              setAddPeriodForm({
                                ...addPeriodForm,
                                cloneFromPeriodId: e.target.value,
                              })
                            }
                            className="mt-1.5 h-7 text-xs w-full"
                          >
                            {periods.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({formatDateVN(p.startDate)} - {formatDateVN(p.endDate)}) -{" "}
                                {p.shiftTemplates?.length ?? 0} ca
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    </label>
                  )}

                  <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252526] cursor-pointer">
                    <input
                      type="radio"
                      name="initMode"
                      checked={addPeriodForm.initMode === "default"}
                      onChange={() =>
                        setAddPeriodForm({ ...addPeriodForm, initMode: "default" })
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-white">
                        Tạo số ca mẫu theo chuẩn cửa hàng
                      </span>
                      {addPeriodForm.initMode === "default" && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-slate-500">Số lượng ca:</span>
                          <Select
                            value={String(addPeriodForm.initialShiftsCount)}
                            onChange={(e) =>
                              setAddPeriodForm({
                                ...addPeriodForm,
                                initialShiftsCount: Number(e.target.value),
                              })
                            }
                            className="h-7 text-xs w-32"
                          >
                            <option value="1">1 ca / ngày</option>
                            <option value="2">2 ca / ngày</option>
                            <option value="3">3 ca / ngày</option>
                            <option value="4">4 ca / ngày</option>
                            <option value="5">5 ca / ngày</option>
                          </Select>
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252526] cursor-pointer">
                    <input
                      type="radio"
                      name="initMode"
                      checked={addPeriodForm.initMode === "empty"}
                      onChange={() =>
                        setAddPeriodForm({ ...addPeriodForm, initMode: "empty" })
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-white">
                        Bảng trống hoàn toàn (tự thêm ca sau)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Không tự tạo ca mẫu nào, bạn có thể tự định nghĩa các ca riêng.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-[#333333]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddPeriodOpen(false)}
                className="h-8 text-xs font-semibold"
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(addPeriodConflict) || loading}
                onClick={handleCreatePeriod}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tạo bảng cấu hình</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Edit Period Date Range */}
      {isEditPeriodRangeOpen && activePeriod && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#3C3C3C] dark:bg-[#1E1E1E]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#333333]">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-slate-800 dark:text-white" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Chỉnh sửa khoảng ngày cấu hình
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPeriodRangeOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#2D2D30]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tên bảng cấu hình
                </label>
                <Input
                  value={editPeriodRangeForm.name}
                  onChange={(e) =>
                    setEditPeriodRangeForm({
                      ...editPeriodRangeForm,
                      name: e.target.value,
                    })
                  }
                  className="mt-1 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Từ ngày
                  </label>
                  <Input
                    type="date"
                    value={editPeriodRangeForm.startDate}
                    onChange={(e) =>
                      setEditPeriodRangeForm({
                        ...editPeriodRangeForm,
                        startDate: e.target.value,
                      })
                    }
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Đến ngày
                  </label>
                  <Input
                    type="date"
                    value={editPeriodRangeForm.endDate}
                    onChange={(e) =>
                      setEditPeriodRangeForm({
                        ...editPeriodRangeForm,
                        endDate: e.target.value,
                      })
                    }
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              {/* Real-time Conflict Alert */}
              {editPeriodConflict && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Không thể lưu do trùng ngày:</p>
                    <p>
                      Khoảng ngày này bị trùng với bảng <strong>&quot;{editPeriodConflict.name}&quot;</strong> (
                      {formatDateVN(editPeriodConflict.startDate)} - {formatDateVN(editPeriodConflict.endDate)}).
                    </p>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-[#9D9D9D]">
                Thao tác mở rộng hoặc thu hẹp khoảng ngày sẽ cập nhật phạm vi áp dụng của các ca trong bảng này.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-[#333333]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditPeriodRangeOpen(false)}
                className="h-8 text-xs font-semibold"
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(editPeriodConflict) || loading}
                onClick={handleUpdatePeriodRange}
                className="h-8 text-xs font-semibold"
              >
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
