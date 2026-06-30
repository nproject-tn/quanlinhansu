"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, GripVertical, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDayNoteColor } from "@/lib/day-note-colors";
import { cn } from "@/lib/utils";
import type { ScheduleConflict } from "@/lib/schedule-engine";

type Employee = {
  id: string;
  name: string;
  position: string;
  storeIds?: string[];
};

type Shift = {
  id: string;
  storeId: string;
  name: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

type Store = { id: string; name: string; logoUrl?: string };

type Slot = {
  storeId: string;
  shiftTemplateId: string;
  date: string;
  slotIndex: number;
  requiredStaff: number;
  employeeId: string | null;
  assignmentId?: string;
};

type Unfilled = { storeName: string; shiftName: string; date: string };
type DayNote = { date: string; note: string; colorKey: string };

type ScheduleCalendarProps = {
  stores: Store[];
  shifts: Shift[];
  slots: Slot[];
  employees: Employee[];
  dayNotes: DayNote[];
  unfilled: Unfilled[];
  selectedEmployeeId: string;
  layoutMode: "horizontal" | "vertical";
  canEdit: boolean;
  onRefresh: () => void;
};

function slotKey(slot: Pick<Slot, "storeId" | "shiftTemplateId" | "date" | "slotIndex">) {
  return `${slot.storeId}|${slot.shiftTemplateId}|${slot.date}|${slot.slotIndex}`;
}

const dragId = (key: string) => `drag|${key}`;
const dropId = (key: string) => `drop|${key}`;

function parseDragOrDropId(id: string, slots: Slot[]): Slot | undefined {
  const prefix = id.startsWith("drag|") ? "drag|" : id.startsWith("drop|") ? "drop|" : null;
  if (!prefix) return undefined;
  const key = id.slice(prefix.length);
  const [storeId, shiftTemplateId, date, slotIndex] = key.split("|");
  return slots.find(
    (s) =>
      s.storeId === storeId &&
      s.shiftTemplateId === shiftTemplateId &&
      s.date === date &&
      s.slotIndex === Number(slotIndex)
  );
}

function SlotCard({
  slot,
  shift,
  store,
  employee,
  employees,
  canEdit,
  loading,
  onAssign,
  onClear,
}: {
  slot: Slot;
  shift?: Shift;
  store: Store;
  employee?: Employee;
  employees: Employee[];
  canEdit: boolean;
  loading: boolean;
  onAssign: (employeeId: string) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const key = slotKey(slot);
  const eligible = employees.filter((e) => !e.storeIds || e.storeIds.includes(slot.storeId));

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: dragId(key),
    disabled: !canEdit || !employee || loading,
    data: { slot },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropId(key),
    disabled: !canEdit || loading,
    data: { slot },
  });

  return (
    <div
      ref={setDropRef}
      className={cn(
        "rounded-lg border p-2 text-xs transition-colors",
        employee ? "border-blue-200 bg-blue-50" : "border-dashed border-slate-300 bg-slate-50",
        isOver && canEdit && "ring-2 ring-blue-400",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800">
            {shift?.name} ({shift?.startTime}-{shift?.endTime})
          </p>
          <p className="text-slate-500">{store.name}</p>
        </div>
        {canEdit && employee && (
          <button
            ref={setDragRef}
            type="button"
            className="touch-none rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600"
            {...listeners}
            {...attributes}
            aria-label="Kéo để đổi ca"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </div>

      {employee ? (
        <div className="mt-1 flex items-center justify-between gap-1">
          <p className="font-semibold text-slate-900">{employee.name}</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => onClear()}
              disabled={loading}
              className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Xóa phân công"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : canEdit ? (
        <Select
          className="mt-1 h-8 text-xs"
          value=""
          disabled={loading}
          onChange={(e) => {
            const val = e.target.value;
            if (val) onAssign(val);
          }}
        >
          <option value="">— Chọn nhân viên —</option>
          {eligible.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      ) : (
        <p className="mt-1 font-semibold text-slate-400">— Trống —</p>
      )}

      <Badge
        variant={slot.requiredStaff <= 1 ? "warning" : "default"}
        className={cn(
          "mt-1",
          slot.requiredStaff > 1 && "border-rose-200 bg-rose-100 text-rose-700"
        )}
      >
        {slot.requiredStaff} người/ca
        {slot.requiredStaff > 1 ? ` · vị trí ${slot.slotIndex + 1}` : ""}
      </Badge>
    </div>
  );
}

function StoreLogo({
  store,
  className,
  imageClassName,
  fallbackClassName,
}: {
  store: Store;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}) {
  const initials = store.name.trim().slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white",
        className
      )}
    >
      {store.logoUrl ? (
        <img
          src={store.logoUrl}
          alt={store.name}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      ) : (
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400",
            fallbackClassName
          )}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

function CompactSlotGroup({
  slots,
  shift,
  store,
  employeeMap,
  employees,
  canEdit,
  loading,
  selectedEmployeeId,
  onAssign,
  onClear,
}: {
  slots: Slot[];
  shift: Shift;
  store: Store;
  employeeMap: Map<string, Employee>;
  employees: Employee[];
  canEdit: boolean;
  loading: boolean;
  selectedEmployeeId?: string;
  onAssign: (slot: Slot, employeeId: string) => Promise<void>;
  onClear: (slot: Slot) => Promise<void>;
}) {
  const orderedSlots = [...slots].sort((a, b) => a.slotIndex - b.slotIndex);
  const assignedSlots = orderedSlots.filter((slot) => Boolean(slot.employeeId));
  const emptySlots = orderedSlots.filter((slot) => !slot.employeeId);
  const hasAssigned = assignedSlots.length > 0;
  const showEmptySlots = !selectedEmployeeId;

  return (
    <div
      className={cn(
        "rounded-lg border p-2 text-xs transition-colors",
        hasAssigned ? "border-blue-200 bg-blue-50" : "border-dashed border-slate-300 bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{shift.name}</p>
          <p className="text-slate-500">
            {shift.startTime}-{shift.endTime}
          </p>
          <p className="text-slate-500">{store.name}</p>
        </div>
      </div>

      {assignedSlots.length > 0 ? (
        <div className="mt-1 space-y-1">
          <div className="min-w-0 flex-1 space-y-1">
            {assignedSlots.map((slot) => {
              const employee = employeeMap.get(slot.employeeId ?? "");
              if (!employee) return null;

              return (
                <div key={slotKey(slot)} className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{employee.name}</p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onClear(slot)}
                      disabled={loading}
                      className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Xóa ${employee.name} khỏi ${shift.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : canEdit ? (
        <p className="mt-1 font-semibold text-slate-400">— Trống —</p>
      ) : (
        <p className="mt-1 font-semibold text-slate-400">— Trống —</p>
      )}

      {canEdit && showEmptySlots && emptySlots.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {emptySlots.map((slot) => (
            <Select
              key={slotKey(slot)}
              className="h-8 text-xs"
              value=""
              disabled={loading}
              onChange={(e) => {
                const val = e.target.value;
                if (val) void onAssign(slot, val);
              }}
            >
              <option value="">— Chọn nhân viên —</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </Select>
          ))}
        </div>
      )}

      <Badge
        variant={slots[0]?.requiredStaff <= 1 ? "warning" : "default"}
        className={cn(
          "mt-1",
          (slots[0]?.requiredStaff ?? slots.length) > 1 &&
            "border-rose-200 bg-rose-100 text-rose-700"
        )}
      >
        {slots[0]?.requiredStaff ?? slots.length} người/ca
        {(slots[0]?.requiredStaff ?? slots.length) > 1
          ? ` · ${assignedSlots.length} đã xếp`
          : ""}
      </Badge>
    </div>
  );
}

export function ScheduleCalendar({
  stores,
  shifts,
  slots,
  employees,
  dayNotes,
  unfilled,
  selectedEmployeeId,
  layoutMode,
  canEdit,
  onRefresh,
}: ScheduleCalendarProps) {
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [showToasts, setShowToasts] = useState(true);
  const [renderedToast, setRenderedToast] = useState<{
    id: string;
    title: string;
    body: string;
    tone: "warning" | "error" | "success";
    icon: typeof AlertTriangle;
  } | null>(null);
  const [toastPhase, setToastPhase] = useState<"enter" | "exit">("enter");
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const notificationShellRef = useRef<HTMLDivElement | null>(null);
  const plannerScrollRef = useRef<HTMLDivElement | null>(null);
  const plannerTableRef = useRef<HTMLTableElement | null>(null);
  const plannerScrollbarTrackRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const scrollbarDragStateRef = useRef<{
    pointerStartX: number;
    scrollLeftStart: number;
  } | null>(null);
  const [plannerContentWidth, setPlannerContentWidth] = useState(0);
  const [plannerViewportWidth, setPlannerViewportWidth] = useState(0);
  const [plannerScrollLeft, setPlannerScrollLeft] = useState(0);

  useEffect(() => {
    if (!message && conflicts.length === 0 && unfilled.length === 0) return;
    setShowToasts(true);
  }, [message, conflicts, unfilled.length]);

  useEffect(() => {
    if (!showNotificationCenter) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationShellRef.current?.contains(event.target as Node)) {
        setShowNotificationCenter(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showNotificationCenter]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyR") return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTypingTarget =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable;

      if (isTypingTarget) return;
      setIsSpacePressed(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "KeyR") return;
      setIsSpacePressed(false);
      setIsPanning(false);
      panStateRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!panStateRef.current || !plannerScrollRef.current) return;

      const deltaX = event.clientX - panStateRef.current.startX;
      const deltaY = event.clientY - panStateRef.current.startY;
      plannerScrollRef.current.scrollLeft = panStateRef.current.scrollLeft - deltaX;
      plannerScrollRef.current.scrollTop = panStateRef.current.scrollTop - deltaY;
    };

    const handleMouseUp = () => {
      panStateRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const updatePlannerMetrics = () => {
      setPlannerContentWidth(plannerTableRef.current?.scrollWidth ?? 0);
      setPlannerViewportWidth(plannerScrollRef.current?.clientWidth ?? 0);
      setPlannerScrollLeft(plannerScrollRef.current?.scrollLeft ?? 0);
    };

    updatePlannerMetrics();

    const resizeObserver =
      typeof ResizeObserver === "undefined" || !plannerTableRef.current
        ? null
        : new ResizeObserver(() => updatePlannerMetrics());

    if (resizeObserver && plannerTableRef.current) {
      resizeObserver.observe(plannerTableRef.current);
    }
    if (resizeObserver && plannerScrollRef.current) {
      resizeObserver.observe(plannerScrollRef.current);
    }

    window.addEventListener("resize", updatePlannerMetrics);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePlannerMetrics);
    };
  }, [stores.length, shifts.length, slots.length, layoutMode]);

  useEffect(() => {
    const mainScroller = plannerScrollRef.current;
    if (!mainScroller) return;

    const syncFromMain = () => {
      setPlannerScrollLeft(mainScroller.scrollLeft);
      setPlannerViewportWidth(mainScroller.clientWidth);
    };

    mainScroller.addEventListener("scroll", syncFromMain);
    syncFromMain();

    return () => {
      mainScroller.removeEventListener("scroll", syncFromMain);
    };
  }, [plannerContentWidth, layoutMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const dates = useMemo(() => [...new Set(slots.map((s) => s.date))].sort(), [slots]);
  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );
  const eligibleEmployeesByStore = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const store of stores) {
      map.set(
        store.id,
        employees.filter((employee) => !employee.storeIds || employee.storeIds.includes(store.id))
      );
    }
    return map;
  }, [employees, stores]);
  const slotsByGroup = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = `${slot.date}|${slot.storeId}|${slot.shiftTemplateId}`;
      const group = map.get(key) ?? [];
      group.push(slot);
      map.set(key, group);
    }
    return map;
  }, [slots]);
  const dayNoteMap = useMemo(
    () => new Map(dayNotes.map((note) => [note.date, note])),
    [dayNotes]
  );
  const filteredEmployeeSlots = useMemo(
    () =>
      selectedEmployeeId
        ? slots.filter((slot) => slot.employeeId === selectedEmployeeId)
        : slots,
    [selectedEmployeeId, slots]
  );
  const shiftsByStore = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const store of stores) {
      map.set(
        store.id,
        shifts.filter((shift) => shift.storeId === store.id).sort((a, b) => a.sortOrder - b.sortOrder)
      );
    }
    return map;
  }, [shifts, stores]);
  const visibleDates = useMemo(
    () => [...new Set(filteredEmployeeSlots.map((slot) => slot.date))].sort(),
    [filteredEmployeeSlots]
  );
  const visibleStores = useMemo(() => {
    if (!selectedEmployeeId) return stores;
    const visibleStoreIds = new Set(filteredEmployeeSlots.map((slot) => slot.storeId));
    return stores.filter((store) => visibleStoreIds.has(store.id));
  }, [filteredEmployeeSlots, selectedEmployeeId, stores]);
  const visibleShiftIdsByStore = useMemo(() => {
    if (!selectedEmployeeId) {
      return new Map(
        stores.map((store) => [store.id, new Set((shiftsByStore.get(store.id) ?? []).map((shift) => shift.id))])
      );
    }

    const map = new Map<string, Set<string>>();
    for (const slot of filteredEmployeeSlots) {
      const current = map.get(slot.storeId) ?? new Set<string>();
      current.add(slot.shiftTemplateId);
      map.set(slot.storeId, current);
    }
    return map;
  }, [filteredEmployeeSlots, selectedEmployeeId, shiftsByStore, stores]);

  async function assignEmployee(
    slot: Slot,
    employeeId: string | null,
    confirmOverCapacity = false
  ) {
    setLoading(true);
    setConflicts([]);
    setMessage(null);
    try {
      const res = await fetch("/api/schedule/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: slot.assignmentId,
          storeId: slot.storeId,
          shiftTemplateId: slot.shiftTemplateId,
          date: slot.date,
          slotIndex: slot.slotIndex,
          employeeId,
          requiredStaff: slot.requiredStaff,
          confirmOverCapacity,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.requiresConfirmation) {
        const ok = window.confirm(
          `${data.error}\n\n${(data.conflicts ?? []).map((c: ScheduleConflict) => c.message).join("\n")}\n\nXác nhận vẫn xếp ca?`
        );
        if (ok) {
          await assignEmployee(slot, employeeId, true);
          return;
        }
        setConflicts(data.conflicts ?? []);
        return;
      }

      if (!res.ok) {
        setConflicts(data.conflicts ?? []);
        setMessageType("error");
        setMessage(typeof data.error === "string" ? data.error : "Không thể cập nhật ca");
        return;
      }

      setMessageType("success");
      setMessage(data.message ?? "Đã cập nhật ca");
      await onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function moveAssignment(
    sourceSlot: Slot,
    targetSlot: Slot,
    confirmMove = false
  ) {
    const res = await fetch("/api/schedule/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAssignmentId: sourceSlot.assignmentId,
        targetStoreId: targetSlot.storeId,
        targetShiftTemplateId: targetSlot.shiftTemplateId,
        targetDate: targetSlot.date,
        targetSlotIndex: targetSlot.slotIndex,
        targetRequiredStaff: targetSlot.requiredStaff,
        confirmOverCapacity: confirmMove,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveSlot(null);
    if (!canEdit) return;

    const { active, over } = event;
    if (!over) return;

    const sourceSlot = parseDragOrDropId(String(active.id), slots);
    const targetSlot = parseDragOrDropId(String(over.id), slots);

    if (!sourceSlot?.employeeId || !targetSlot) return;
    if (slotKey(sourceSlot) === slotKey(targetSlot)) return;

    setLoading(true);
    setConflicts([]);
    setMessage(null);

    try {
      const result = await moveAssignment(sourceSlot, targetSlot);

      if (result.data?.requiresConfirmation) {
        const ok = window.confirm(
          `${result.data.error}\n\n${(result.data.conflicts ?? [])
            .map((conflict: ScheduleConflict) => conflict.message)
            .join("\n")}\n\nXác nhận vẫn đổi ca?`
        );
        if (ok) {
          const confirmed = await moveAssignment(sourceSlot, targetSlot, true);
          if (!confirmed.ok) {
            setConflicts(confirmed.data.conflicts ?? []);
            setMessageType("error");
            setMessage(confirmed.data.error ?? "Không thể đổi ca");
            return;
          }
          setMessageType("success");
          setMessage(confirmed.data.message ?? "Đã cập nhật ca");
          await onRefresh();
          return;
        }
        setConflicts(result.data.conflicts ?? []);
        return;
      }

      if (!result.ok) {
        setConflicts(result.data.conflicts ?? []);
        setMessageType("error");
        setMessage(result.data.error ?? "Không thể đổi ca");
        return;
      }

      setMessageType("success");
      setMessage(result.data.message ?? "Đã cập nhật ca");
      await onRefresh();
    } finally {
      setLoading(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const slot = parseDragOrDropId(String(event.active.id), slots);
    if (slot?.employeeId) setActiveSlot(slot);
  }

  const activeEmployee = activeSlot ? employeeMap.get(activeSlot.employeeId ?? "") : null;
  const notifications = [
    ...(unfilled.length > 0
      ? [
          {
            id: "unfilled",
            title: `Còn ${unfilled.length} ca trống`,
            body: "Chọn nhân viên hoặc xếp tự động.",
            tone: "warning" as const,
            icon: AlertTriangle,
          },
        ]
      : []),
    ...(conflicts.length > 0
      ? [
          {
            id: "conflicts",
            title: "Xung đột xếp ca",
            body: conflicts.slice(0, 3).map((conflict) => conflict.message).join(" "),
            tone: "error" as const,
            icon: AlertCircle,
          },
        ]
      : []),
    ...(message
      ? [
          {
            id: "message",
            title: messageType === "success" ? "Cập nhật thành công" : "Không thể cập nhật",
            body: message,
            tone: messageType === "success" ? ("success" as const) : ("error" as const),
            icon: messageType === "success" ? CheckCircle2 : AlertCircle,
          },
        ]
      : []),
  ];
  const hasNotificationDot = notifications.length > 0;
  const currentToast = message
    ? notifications.find((notification) => notification.id === "message")
    : conflicts.length > 0
      ? notifications.find((notification) => notification.id === "conflicts")
      : notifications.find((notification) => notification.id === "unfilled");
  const currentToastSignature = currentToast
    ? `${currentToast.id}|${currentToast.title}|${currentToast.body}|${currentToast.tone}`
    : null;

  useEffect(() => {
    if (!showToasts || !currentToast) {
      if (renderedToast) {
        setToastPhase("exit");
        const cleanupTimer = window.setTimeout(() => setRenderedToast(null), 260);
        return () => window.clearTimeout(cleanupTimer);
      }
      return;
    }

    setRenderedToast(currentToast);
    setToastPhase("enter");

    const hideTimer = window.setTimeout(() => {
      setToastPhase("exit");
      setShowToasts(false);
    }, 3000);
    const cleanupTimer = window.setTimeout(() => setRenderedToast(null), 3260);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [currentToastSignature, showToasts]);

  function handlePlannerMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (!isSpacePressed || !plannerScrollRef.current) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, select, input, option")) return;

    event.preventDefault();
    panStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: plannerScrollRef.current.scrollLeft,
      scrollTop: plannerScrollRef.current.scrollTop,
    };
    setIsPanning(true);
  }

  function handleScrollbarTrackPointerDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (!plannerScrollRef.current || !plannerScrollbarTrackRef.current) return;

    const trackRect = plannerScrollbarTrackRef.current.getBoundingClientRect();
    const clickOffset = event.clientX - trackRect.left;
    const maxScrollLeft = Math.max(plannerContentWidth - plannerViewportWidth, 0);
    if (maxScrollLeft <= 0) return;

    const thumbWidth = Math.max((plannerViewportWidth / plannerContentWidth) * trackRect.width, 48);
    const usableTrack = Math.max(trackRect.width - thumbWidth, 1);
    const nextScrollLeft = Math.min(
      Math.max(((clickOffset - thumbWidth / 2) / usableTrack) * maxScrollLeft, 0),
      maxScrollLeft
    );

    plannerScrollRef.current.scrollLeft = nextScrollLeft;
  }

  function handleScrollbarThumbPointerDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (!plannerScrollRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    scrollbarDragStateRef.current = {
      pointerStartX: event.clientX,
      scrollLeftStart: plannerScrollRef.current.scrollLeft,
    };
  }

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!scrollbarDragStateRef.current || !plannerScrollRef.current || !plannerScrollbarTrackRef.current) {
        return;
      }

      const trackRect = plannerScrollbarTrackRef.current.getBoundingClientRect();
      const maxScrollLeft = Math.max(plannerContentWidth - plannerViewportWidth, 0);
      if (maxScrollLeft <= 0) return;

      const thumbWidth = Math.max((plannerViewportWidth / plannerContentWidth) * trackRect.width, 48);
      const usableTrack = Math.max(trackRect.width - thumbWidth, 1);
      const deltaX = event.clientX - scrollbarDragStateRef.current.pointerStartX;
      const scrollDelta = (deltaX / usableTrack) * maxScrollLeft;

      plannerScrollRef.current.scrollLeft = scrollbarDragStateRef.current.scrollLeftStart + scrollDelta;
    };

    const handlePointerUp = () => {
      scrollbarDragStateRef.current = null;
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [plannerContentWidth, plannerViewportWidth]);

  if (slots.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          <p className="font-medium">Chưa có ca nào để xếp.</p>
          <p className="mt-1 text-sm">Vào <strong>Cấu hình ca</strong> để thiết lập ca cho cửa hàng.</p>
        </CardContent>
      </Card>
    );
  }

  if (selectedEmployeeId && filteredEmployeeSlots.length === 0) {
    const selectedEmployee = employeeMap.get(selectedEmployeeId);

    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          <p className="font-medium">
            {selectedEmployee?.name ?? "Nhân viên này"} chưa có ca nào trong khoảng đang xem.
          </p>
          <p className="mt-1 text-sm">Đổi tuần/tháng hoặc bỏ bộ lọc nhân viên để xem toàn bộ lịch.</p>
        </CardContent>
      </Card>
    );
  }

  const hasHorizontalOverflow = plannerContentWidth > plannerViewportWidth + 4;
  const scrollbarThumbWidthPercent = hasHorizontalOverflow
    ? Math.max((plannerViewportWidth / plannerContentWidth) * 100, 12)
    : 100;
  const maxScrollLeft = Math.max(plannerContentWidth - plannerViewportWidth, 0);
  const scrollbarThumbOffsetPercent =
    hasHorizontalOverflow && maxScrollLeft > 0
      ? (plannerScrollLeft / maxScrollLeft) * (100 - scrollbarThumbWidthPercent)
      : 0;

  return (
    <div className="space-y-4">
      <div
        ref={notificationShellRef}
        className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col items-end gap-3"
      >
        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => {
              setShowNotificationCenter((current) => !current);
              setShowToasts(false);
            }}
            className="toast-liquid flex h-12 w-12 items-center justify-center rounded-2xl border-slate-200/70 text-slate-700 transition-transform hover:scale-[1.02]"
            aria-label="Mở thông báo"
          >
            <Bell className="h-5 w-5" />
            {hasNotificationDot && (
              <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(255,255,255,0.5)]" />
            )}
          </button>
        </div>

        {showNotificationCenter && hasNotificationDot && (
          <div className="toast-liquid toast-enter pointer-events-auto w-full border-slate-200/70 text-slate-900">
            <div className="space-y-3">
              {notifications.map((notification) => {
                const Icon = notification.icon;
                return (
                  <div key={notification.id} className="flex items-start gap-3">
                    <Icon
                      className={cn(
                        "mt-0.5 h-5 w-5 shrink-0",
                        notification.tone === "warning" && "text-amber-500",
                        notification.tone === "error" && "text-rose-500",
                        notification.tone === "success" && "text-emerald-500"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-700/80">{notification.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {renderedToast &&
          (() => {
            const notification = renderedToast;
            const Icon = notification.icon;
            return (
              <div
                key={`toast-${notification.id}`}
                className={cn(
                  "toast-liquid pointer-events-auto w-full",
                  toastPhase === "enter" ? "toast-enter" : "toast-exit",
                  notification.tone === "warning" && "border-amber-200/70 text-amber-950",
                  notification.tone === "error" && "border-rose-200/70 text-rose-950",
                  notification.tone === "success" && "border-emerald-200/70 text-emerald-950"
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={cn(
                      "mt-0.5 h-5 w-5 shrink-0",
                      notification.tone === "warning" && "text-amber-500",
                      notification.tone === "error" && "text-rose-500",
                      notification.tone === "success" && "text-emerald-500"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="mt-1 text-sm opacity-85">{notification.body}</p>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>

      {canEdit && (
        <p className="text-sm text-slate-600">
          Chọn nhân viên từ dropdown, kéo biểu tượng <GripVertical className="inline h-3 w-3" /> để đổi ca,
          hoặc bấm <X className="inline h-3 w-3" /> để xóa nhân viên khỏi ca. Giữ <strong>R</strong> rồi kéo chuột để di chuyển bảng ngang.
        </p>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {layoutMode === "horizontal" ? (
        <Card>
          <CardHeader>
            <CardTitle>Lịch xếp ca dạng bảng ngang</CardTitle>
          </CardHeader>
          <CardContent className="group px-0 py-0">
            <div
              ref={plannerScrollRef}
              onMouseDown={handlePlannerMouseDown}
              className={cn(
                "hover-scrollbars max-h-[calc(100vh-16rem)] overflow-auto",
                isSpacePressed && "cursor-grab",
                isPanning && "cursor-grabbing select-none"
              )}
            >
              <table
                ref={plannerTableRef}
                className="w-max min-w-full border-separate border-spacing-0 text-sm"
              >
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-30 min-w-[180px] border-r border-b border-slate-200 bg-slate-100 px-4 py-2 text-left font-semibold text-slate-900">
                      Ca làm
                    </th>
                    {visibleDates.map((date) => {
                      const note = dayNoteMap.get(date);
                      const color = getDayNoteColor(note?.colorKey);
                      return (
                        <th
                          key={date}
                          className={cn(
                            "sticky top-0 z-20 min-w-[240px] border-r border-b border-slate-200 px-3 py-2 align-top text-center",
                            note ? color.softClass : "bg-slate-50"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="min-h-[16px] text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                              {note?.note ?? ""}
                            </div>
                            <div className="font-semibold capitalize text-slate-900">
                              {format(parseISO(date), "EEEE", { locale: vi })}
                            </div>
                            <div className="text-sm font-medium text-slate-700">
                              {format(parseISO(date), "dd/MM/yyyy")}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleStores.map((store) => {
                    const storeShifts = (shiftsByStore.get(store.id) ?? []).filter((shift) =>
                      visibleShiftIdsByStore.get(store.id)?.has(shift.id)
                    );
                    return (
                      <Fragment key={store.id}>
                        <tr key={`${store.id}-header`}>
                          <td className="sticky top-[78px] left-0 z-20 border-r border-b border-slate-200 bg-slate-100 px-4 py-2 font-bold text-slate-900">
                            <div className="flex items-center gap-3">
                              <StoreLogo
                                store={store}
                                className="h-5 w-5 bg-white"
                                fallbackClassName="text-[8px]"
                              />
                              <span>{store.name}</span>
                            </div>
                          </td>
                          {visibleDates.map((date) => {
                            const note = dayNoteMap.get(date);
                            return (
                              <td
                                key={`${store.id}-${date}-header`}
                                className={cn(
                                  "sticky top-[78px] z-10 border-r border-b border-slate-200 px-3 py-2",
                                  note ? getDayNoteColor(note.colorKey).softClass : "bg-white"
                                )}
                              >
                                <div className="flex min-h-6 items-center justify-center">
                                  <StoreLogo
                                    store={store}
                                    className="h-5 w-5 border-slate-200 bg-white shadow-sm"
                                    fallbackClassName="text-[7px] text-slate-300"
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                        {storeShifts.map((shift) => (
                          <tr key={`${store.id}-${shift.id}`}>
                            <td className="sticky left-0 z-10 border-r border-b border-slate-200 bg-white px-4 py-2 align-top">
                              <div className="font-semibold text-slate-900">{shift.name}</div>
                              <div className="text-xs text-slate-500">
                                {shift.startTime}-{shift.endTime}
                              </div>
                            </td>
                            {visibleDates.map((date) => {
                              const daySlots = slotsByGroup.get(`${date}|${store.id}|${shift.id}`) ?? [];
                              const hasSelectedEmployeeInGroup =
                                !selectedEmployeeId ||
                                daySlots.some((slot) => slot.employeeId === selectedEmployeeId);
                              const note = dayNoteMap.get(date);
                              return (
                                <td
                                  key={`${store.id}-${shift.id}-${date}`}
                                  className={cn(
                                    "min-w-[240px] border-r border-b border-slate-200 align-top",
                                    note ? getDayNoteColor(note.colorKey).softClass : "bg-white"
                                  )}
                                >
                                  <div className="space-y-1.5 p-1.5">
                                    {daySlots.length > 0 && hasSelectedEmployeeInGroup ? (
                                      <CompactSlotGroup
                                        slots={daySlots}
                                        shift={shift}
                                        store={store}
                                        employeeMap={employeeMap}
                                        employees={eligibleEmployeesByStore.get(store.id) ?? []}
                                        canEdit={canEdit}
                                        loading={loading}
                                        selectedEmployeeId={selectedEmployeeId}
                                        onAssign={(slot, id) => assignEmployee(slot, id)}
                                        onClear={(slot) => assignEmployee(slot, null)}
                                      />
                                    ) : selectedEmployeeId ? (
                                      <div className="min-h-[112px]" />
                                    ) : (
                                      <div className="rounded-md border border-dashed border-slate-200 bg-white/70 px-3 py-3 text-center text-xs text-slate-400">
                                        Không có ca
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 pb-3 pt-1">
              <div
                ref={plannerScrollbarTrackRef}
                onMouseDown={handleScrollbarTrackPointerDown}
                className={cn(
                  "relative h-2 rounded-full bg-slate-200/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                  hasHorizontalOverflow ? "cursor-pointer" : "pointer-events-none"
                )}
              >
                <div
                  onMouseDown={handleScrollbarThumbPointerDown}
                  className={cn(
                    "absolute top-0 h-2 rounded-full bg-slate-500/70 shadow-sm transition-colors",
                    hasHorizontalOverflow ? "cursor-grab hover:bg-slate-600/80 active:cursor-grabbing" : "hidden"
                  )}
                  style={{
                    width: `${scrollbarThumbWidthPercent}%`,
                    left: `${scrollbarThumbOffsetPercent}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        ) : (
          <div className="space-y-6">
            {visibleDates.map((date) => (
              <Card
                key={date}
                className={cn(
                  dayNoteMap.get(date) && getDayNoteColor(dayNoteMap.get(date)?.colorKey).softClass
                )}
              >
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 capitalize">
                    <span>{format(parseISO(date), "EEEE, dd/MM/yyyy", { locale: vi })}</span>
                    {dayNoteMap.get(date) && (
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium normal-case",
                          getDayNoteColor(dayNoteMap.get(date)?.colorKey).chipClass
                        )}
                      >
                        {dayNoteMap.get(date)?.note}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {visibleStores.map((store) => (
                      <div key={store.id} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <StoreLogo
                            store={store}
                            className="h-5 w-5 bg-white"
                            fallbackClassName="text-[8px]"
                          />
                          <h4 className="font-semibold text-slate-800">{store.name}</h4>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {shiftsByStore
                            .get(store.id)
                            ?.filter((shift) => visibleShiftIdsByStore.get(store.id)?.has(shift.id))
                            .flatMap((shift) =>
                            (() => {
                              const daySlots = slotsByGroup.get(`${date}|${store.id}|${shift.id}`) ?? [];
                              if (
                                daySlots.length === 0 ||
                                (selectedEmployeeId &&
                                  !daySlots.some((slot) => slot.employeeId === selectedEmployeeId))
                              ) {
                                return [];
                              }

                              return [
                                <CompactSlotGroup
                                  key={`${date}|${store.id}|${shift.id}`}
                                  slots={daySlots}
                                  shift={shift}
                                  store={store}
                                  employeeMap={employeeMap}
                                  employees={eligibleEmployeesByStore.get(store.id) ?? []}
                                  canEdit={canEdit}
                                  loading={loading}
                                  selectedEmployeeId={selectedEmployeeId}
                                  onAssign={(slot, id) => assignEmployee(slot, id)}
                                  onClear={(slot) => assignEmployee(slot, null)}
                                />,
                              ];
                            })()
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <DragOverlay>
          {activeEmployee ? (
            <div className="rounded-lg border border-blue-300 bg-blue-100 px-4 py-2 shadow-lg">
              <p className="font-semibold">{activeEmployee.name}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
