"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { useNotifications } from "@/components/notifications/notification-center";
import { getDayNoteColor, DAY_NOTE_COLORS } from "@/lib/day-note-colors";
import { DAY_NAMES, formatDateOnly, parseDateOnly } from "@/lib/utils";
import { calcDurationHours } from "@/lib/shift-utils";
import { getDateRange, getDaysInRange } from "@/lib/schedule-engine";

type Store = { id: string; name: string; logoUrl?: string; shiftsPerDay?: number };
type ShiftTemplate = {
  id: string;
  storeId: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  sortOrder: number;
};
type StaffingRule = {
  storeId: string;
  shiftTemplateId: string;
  dayOfWeek: number;
  requiredStaff: number;
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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {store?.logoUrl ? (
        <img src={store.logoUrl} alt={store.name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {initials}
        </span>
      )}
    </div>
  );
}

export default function ShiftConfigPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
  const [rules, setRules] = useState<StaffingRule[]>([]);
  const [overrides, setOverrides] = useState<StaffingOverride[]>([]);
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const store = sessionStorage.getItem("config_selectedStore");
    if (store) setSelectedStore(store);
    const month = sessionStorage.getItem("config_selectedMonth");
    if (month) setSelectedMonth(month);
    setIsInitialized(true);
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingShift, setEditingShift] = useState<string | null>(null);
  const [openColorPickerDate, setOpenColorPickerDate] = useState<string | null>(null);
  const [recentColorKeys, setRecentColorKeys] = useState<string[]>(DAY_NOTE_COLORS.slice(0, 4).map((color) => color.key));
  const [editForm, setEditForm] = useState({
    name: "",
    startTime: "",
    endTime: "",
  });
  const [isAddingShift, setIsAddingShift] = useState(false);
  const [newShiftForm, setNewShiftForm] = useState({
    name: "Ca Mới",
    startTime: "08:00",
    endTime: "16:00",
  });
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

  const monthStart = useMemo(() => parseDateOnly(`${selectedMonth}-01`), [selectedMonth]);
  const monthEnd = useMemo(() => getDateRange("month", monthStart).end, [monthStart]);
  const monthDays = useMemo(() => getDaysInRange(monthStart, monthEnd), [monthEnd, monthStart]);

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

  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      sessionStorage.setItem("config_selectedStore", selectedStore);
      sessionStorage.setItem("config_selectedMonth", selectedMonth);
    }
  }, [selectedStore, selectedMonth, isInitialized]);

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

  function upsertLocalDayNote(dateStr: string, patch: Partial<DayNote>) {
    setDayNotes((items) => {
      const current =
        items.find((item) => item.date === dateStr) ?? {
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

  const loadStoreConfig = useCallback(async (storeId: string, month: string) => {
    if (!storeId) return;

    const start = parseDateOnly(`${month}-01`);
    const from = formatDateOnly(start);
    const to = formatDateOnly(getDateRange("month", start).end);

    setLoading(true);
    try {
      const [shiftRes, ruleRes, overrideRes, dayNoteRes] = await Promise.all([
        fetch(`/api/shift-templates?storeId=${storeId}`),
        fetch(`/api/staffing-rules?storeId=${storeId}`),
        fetch(`/api/staffing-overrides?storeId=${storeId}&from=${from}&to=${to}`),
        fetch(`/api/schedule-day-notes?from=${from}&to=${to}`),
      ]);

      const [shiftData, ruleData, overrideData, dayNoteData] = await Promise.all([
        readJsonSafely<ShiftTemplate[]>(shiftRes, []),
        readJsonSafely<StaffingRule[]>(ruleRes, []),
        readJsonSafely<Array<{ id: string; storeId: string; shiftTemplateId: string; date: string | Date; requiredStaff: number }>>(overrideRes, []),
        readJsonSafely<DayNote[]>(dayNoteRes, []),
      ]);

      setShifts(ensureArray<ShiftTemplate>(shiftData));
      setRules(ensureArray<StaffingRule>(ruleData));
      setOverrides(
        ensureArray<{ id: string; storeId: string; shiftTemplateId: string; date: string | Date; requiredStaff: number }>(overrideData)
          .map((item) => ({
            ...item,
            date:
              typeof item.date === "string"
                ? item.date.slice(0, 10)
                : formatDateOnly(item.date),
          }))
      );
      setDayNotes(ensureArray<DayNote>(dayNoteData));
      if (!dayNoteRes.ok) {
        setMessage("Không tải được ghi chú ngày, nhưng phần cấu hình ca vẫn dùng bình thường.");
      }
    } catch {
      setMessage("Không tải được đầy đủ cấu hình ca. Vui lòng thử tải lại trang.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    void loadStoreConfig(selectedStore, selectedMonth);
  }, [loadStoreConfig, selectedMonth, selectedStore, isInitialized]);

  useEffect(() => {
    if (!message) return;

    notify({
      title: "Thông báo cấu hình ca",
      body: message,
      tone: message.toLowerCase().includes("không") || message.toLowerCase().includes("lỗi") ? "error" : "success",
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
  }, [monthDays.length, shifts.length, selectedStore, loading]);

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
      if (!configScrollbarDragStateRef.current || !configScrollRef.current || !configScrollbarTrackRef.current) {
        return;
      }

      const trackRect = configScrollbarTrackRef.current.getBoundingClientRect();
      const maxScrollLeft = Math.max(configContentWidth - configViewportWidth, 0);
      if (maxScrollLeft <= 0) return;

      const thumbWidth = Math.max((configViewportWidth / configContentWidth) * trackRect.width, 48);
      const usableTrack = Math.max(trackRect.width - thumbWidth, 1);
      const deltaX = event.clientX - configScrollbarDragStateRef.current.pointerStartX;
      const scrollDelta = (deltaX / usableTrack) * maxScrollLeft;

      configScrollRef.current.scrollLeft = configScrollbarDragStateRef.current.scrollLeftStart + scrollDelta;
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
    setMessage(null);
  }

  function getWeeklyRule(shiftId: string, dayOfWeek: number) {
    return (
      rules.find(
        (rule) =>
          rule.storeId === selectedStore &&
          rule.shiftTemplateId === shiftId &&
          rule.dayOfWeek === dayOfWeek
      )?.requiredStaff ?? 1
    );
  }

  function getDailyStaff(shiftId: string, dateStr: string) {
    const override = overrides.find(
      (item) =>
        item.storeId === selectedStore &&
        item.shiftTemplateId === shiftId &&
        item.date === dateStr
    );
    if (override) return override.requiredStaff;

    return getWeeklyRule(shiftId, parseDateOnly(dateStr).getUTCDay());
  }

  function getDayNote(dateStr: string) {
    return ensureArray<DayNote>(dayNotes).find((note) => note.date === dateStr);
  }

  function hasVisibleDayNote(dateStr: string) {
    return Boolean(getDayNote(dateStr)?.note.trim());
  }

  async function updateRule(shiftId: string, dayOfWeek: number, requiredStaff: number) {
    const res = await fetch("/api/staffing-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: selectedStore,
        shiftTemplateId: shiftId,
        dayOfWeek,
        requiredStaff,
      }),
    });

    if (!res.ok) return;

    setRules((current) => {
      const rest = current.filter(
        (rule) =>
          !(
            rule.storeId === selectedStore &&
            rule.shiftTemplateId === shiftId &&
            rule.dayOfWeek === dayOfWeek
          )
      );
      return [...rest, { storeId: selectedStore, shiftTemplateId: shiftId, dayOfWeek, requiredStaff }];
    });
    setMessage("Đã cập nhật số nhân viên mặc định theo thứ trong tuần");
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

  async function applyRuleToMonth(shiftId: string, requiredStaff: number) {
    const payload = monthDays.map((day) => ({
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

    const saved = await readJsonSafely<Array<{ id: string; date: string | Date; requiredStaff: number }>>(res, []);
    setOverrides((current) => {
      const rest = current.filter(
        (item) => !(item.storeId === selectedStore && item.shiftTemplateId === shiftId)
      );
      return [
        ...rest,
        ...(saved as Array<{ id: string; date: string | Date; requiredStaff: number }>).map((item) => ({
          id: item.id,
          storeId: selectedStore,
          shiftTemplateId: shiftId,
          date: typeof item.date === "string" ? item.date.slice(0, 10) : formatDateOnly(item.date),
          requiredStaff: item.requiredStaff,
        })),
      ];
    });
    setMessage(`Đã áp dụng ${requiredStaff} nhân viên cho toàn bộ tháng`);
  }

  async function applyRuleToDay(dateStr: string, requiredStaff: number) {
    const payload = storeShifts.map((shift) => ({
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

    const saved = await readJsonSafely<Array<{ id: string; date: string | Date; shiftTemplateId: string; requiredStaff: number }>>(res, []);
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
    setMessage(`Đã áp dụng ${requiredStaff} nhân viên cho ngày ${format(parseDateOnly(dateStr), "dd/MM")}`);
  }

  async function updateDayNote(dateStr: string, patch: Partial<DayNote>) {
    const current =
      getDayNote(dateStr) ?? {
        date: dateStr,
        note: "",
        colorKey: "amber",
      };

    const next = {
      ...current,
      ...patch,
    };

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

  function startEditShift(shift: ShiftTemplate) {
    setEditingShift(shift.id);
    setEditForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
  }

  async function saveEditShift(shift: ShiftTemplate) {
    const durationHours = calcDurationHours(editForm.startTime, editForm.endTime);
    const res = await fetch(`/api/shift-templates/${shift.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: shift.storeId,
        name: editForm.name,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        durationHours,
        sortOrder: shift.sortOrder,
        isActive: true,
      }),
    });

    if (!res.ok) return;

    setEditingShift(null);
    await loadStoreConfig(selectedStore, selectedMonth);
    setMessage("Đã cập nhật ca");
  }

  async function saveNewShift() {
    const durationHours = calcDurationHours(newShiftForm.startTime, newShiftForm.endTime);
    const res = await fetch(`/api/shift-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: selectedStore,
        name: newShiftForm.name,
        startTime: newShiftForm.startTime,
        endTime: newShiftForm.endTime,
        durationHours,
        sortOrder: 99, // Backend sẽ tự sắp xếp lại
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
    await loadStoreConfig(selectedStore, selectedMonth);
    setMessage("Đã thêm ca mới");
  }

  async function deleteShift(shift: ShiftTemplate) {
    const approved = await confirm({
      title: `Xóa ${shift.name}?`,
      description: "Ca này sẽ bị gỡ khỏi cấu hình của cửa hàng hiện tại.",
      confirmLabel: "Xóa ca",
      cancelLabel: "Giữ lại",
      tone: "destructive",
    });
    if (!approved) return;
    const res = await fetch(`/api/shift-templates/${shift.id}`, { method: "DELETE" });
    const data = await readJsonSafely<{ message?: string }>(res, {});
    setMessage(data.message ?? "Đã xóa");
    await loadStoreConfig(selectedStore, selectedMonth);
  }

  const storeShifts = shifts
    .filter((shift) => shift.storeId === selectedStore)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedStoreData = stores.find((store) => store.id === selectedStore);
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

    const thumbWidth = Math.max((configViewportWidth / configContentWidth) * trackRect.width, 48);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cấu hình ca làm việc</h1>
        <p className="text-slate-600">
          Chỉnh giờ ca, tự tính số tiếng, và đặt số nhân viên cho từng ngày trong tháng.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc cấu hình</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-3">
            <StoreFilterLogo store={selectedStoreData} />
            <Select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="max-w-xs"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.shiftsPerDay ?? 3} ca/ngày)
                </option>
              ))}
            </Select>
          </div>

          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ca hiện tại theo từng ngày trong tháng</CardTitle>
        </CardHeader>
        <CardContent className="group px-0 py-0">
          {loading ? (
            <p className="py-8 text-center text-slate-500">Đang tải cấu hình ca...</p>
          ) : storeShifts.length === 0 ? (
            <p className="px-6 py-6 text-slate-500">Chưa có ca. Vui lòng cấu hình số ca bên mục Cửa hàng.</p>
          ) : (
            <>
            <div ref={configScrollRef} className="hover-scrollbars overflow-x-auto px-6 pt-0">
            <table ref={configTableRef} className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4">Ca</th>
                  <th className="pb-2 pr-4">Giờ</th>
                  <th className="pb-2 pr-4">Thao tác</th>
                  {monthDays.map((day) => (
                    <th
                      key={formatDateOnly(day)}
                      className={`pb-2 px-1 text-center ${hasVisibleDayNote(formatDateOnly(day)) ? getDayNoteColor(getDayNote(formatDateOnly(day))?.colorKey).softClass : ""}`}
                    >
                      <div>{day.getUTCDate()}</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        {DAY_NAMES[day.getUTCDay()].replace("Thứ ", "T")}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b bg-slate-50/60 align-top">
                  <th className="py-2 pr-4 text-xs font-medium text-slate-600" colSpan={3}>
                    Ghi chú ngày / màu đánh dấu
                  </th>
                  {monthDays.map((day) => {
                    const dateStr = formatDateOnly(day);
                    const note = getDayNote(dateStr);
                    const color = getDayNoteColor(note?.colorKey);
                    return (
                      <th
                        key={`note-${dateStr}`}
                        className={`px-1 py-2 ${note?.note.trim() ? color.softClass : ""}`}
                      >
                        <div ref={openColorPickerDate === dateStr ? colorPickerShellRef : null} className="relative space-y-2">
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
                              onBlur={(e) => updateDayNote(dateStr, { note: e.target.value })}
                              placeholder="Ghi chú"
                              className="h-8 min-w-[120px] pr-10 text-xs"
                            />
                            <button
                              type="button"
                              aria-label="Chon mau"
                              className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 rounded-md border border-slate-300 shadow-sm transition-transform hover:scale-105"
                              style={{ backgroundColor: color.swatch }}
                              onClick={() =>
                                setOpenColorPickerDate((current) =>
                                  current === dateStr ? null : dateStr
                                )
                              }
                            />
                          </div>
                          {openColorPickerDate === dateStr && (
                            <div className="absolute left-1/2 top-10 z-20 w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
                              <p className="text-[11px] font-medium text-slate-500">Bảng màu</p>
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                {DAY_NOTE_COLORS.map((option) => (
                                  <button
                                    key={option.key}
                                    type="button"
                                    className={`h-8 rounded-lg border ${option.key === (note?.colorKey ?? "amber") ? "border-slate-900 ring-2 ring-slate-300" : "border-slate-200"}`}
                                    style={{ backgroundColor: option.swatch }}
                                    onClick={() => {
                                      upsertLocalDayNote(dateStr, { colorKey: option.key });
                                      setOpenColorPickerDate(null);
                                      if (note?.note.trim()) {
                                        void updateDayNote(dateStr, { colorKey: option.key });
                                      }
                                    }}
                                    aria-label={option.label}
                                  />
                                ))}
                              </div>
                              <div className="mt-3 border-t border-slate-100 pt-3">
                                <p className="text-[11px] font-medium text-slate-500">Gần đây</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {recentColorKeys.map((colorKey) => {
                                    const recentColor = getDayNoteColor(colorKey);
                                    return (
                                      <button
                                        key={`${dateStr}-${colorKey}`}
                                        type="button"
                                        className="h-7 w-7 rounded-md border border-slate-200"
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
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {storeShifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4 font-medium">
                      {editingShift === shift.id ? (
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="h-8 w-28"
                        />
                      ) : (
                        shift.name
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {editingShift === shift.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="time"
                            value={editForm.startTime}
                            onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                            className="h-8 w-28"
                          />
                          <span>-</span>
                          <Input
                            type="time"
                            value={editForm.endTime}
                            onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                            className="h-8 w-28"
                          />
                          <span className="text-xs text-slate-500">
                            ({calcDurationHours(editForm.startTime, editForm.endTime)}h)
                          </span>
                        </div>
                      ) : (
                        `${shift.startTime}-${shift.endTime} (${shift.durationHours}h)`
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex min-w-[150px] flex-col gap-1">
                        {editingShift === shift.id ? (
                          <>
                            <Button size="sm" onClick={() => saveEditShift(shift)}>
                              Lưu
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingShift(null)}>
                              Hủy
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEditShift(shift)}>
                              Sửa ca
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteShift(shift)}>
                              Xóa ca
                            </Button>
                            <Select
                              className="h-8 text-xs"
                              value=""
                              onChange={(e) =>
                                e.target.value &&
                                applyRuleToMonth(shift.id, Number(e.target.value))
                              }
                            >
                              <option value="">Áp dụng cả tháng</option>
                              {STAFF_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option} nhân viên/ngày
                                </option>
                              ))}
                            </Select>
                          </>
                        )}
                      </div>
                    </td>
                    {monthDays.map((day) => {
                      const dateStr = formatDateOnly(day);
                      const dayNote = getDayNote(dateStr);
                      return (
                        <td
                          key={dateStr}
                          className={`py-3 px-1 text-center ${dayNote?.note.trim() ? getDayNoteColor(dayNote.colorKey).softClass : ""}`}
                        >
                          <Select
                            value={String(getDailyStaff(shift.id, dateStr))}
                            onChange={(e) => updateOverride(shift.id, dateStr, Number(e.target.value))}
                            className="h-8 w-[125px] text-xs"
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
                {isAddingShift && (
                  <tr className="border-b border-slate-100 align-top bg-slate-50/50">
                    <td className="py-3 pr-4 font-medium">
                      <Input
                        value={newShiftForm.name}
                        onChange={(e) => setNewShiftForm({ ...newShiftForm, name: e.target.value })}
                        className="h-8 w-28"
                        placeholder="Tên ca"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1">
                        <Input
                          type="time"
                          value={newShiftForm.startTime}
                          onChange={(e) => setNewShiftForm({ ...newShiftForm, startTime: e.target.value })}
                          className="h-8 w-28"
                        />
                        <span>-</span>
                        <Input
                          type="time"
                          value={newShiftForm.endTime}
                          onChange={(e) => setNewShiftForm({ ...newShiftForm, endTime: e.target.value })}
                          className="h-8 w-28"
                        />
                        <span className="text-xs text-slate-500">
                          ({calcDurationHours(newShiftForm.startTime, newShiftForm.endTime)}h)
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex min-w-[150px] flex-col gap-1">
                        <Button size="sm" onClick={saveNewShift}>
                          Lưu
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsAddingShift(false)}>
                          Hủy
                        </Button>
                      </div>
                    </td>
                    <td colSpan={monthDays.length}></td>
                  </tr>
                )}
                {!isAddingShift && (
                  <tr>
                    <td colSpan={3 + monthDays.length} className="py-4">
                      <Button variant="outline" size="sm" onClick={() => setIsAddingShift(true)}>
                        + Thêm ca mới
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div className="px-6 pb-4 pt-2">
              <div
                ref={configScrollbarTrackRef}
                onMouseDown={handleConfigScrollbarTrackPointerDown}
                className={`relative h-2 rounded-full bg-slate-200/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${hasConfigHorizontalOverflow ? "cursor-pointer" : "pointer-events-none"}`}
              >
                <div
                  onMouseDown={handleConfigScrollbarThumbPointerDown}
                  className={`absolute top-0 h-2 rounded-full bg-slate-500/70 shadow-sm transition-colors ${hasConfigHorizontalOverflow ? "cursor-grab hover:bg-slate-600/80 active:cursor-grabbing" : "hidden"}`}
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

    </div>
  );
}
