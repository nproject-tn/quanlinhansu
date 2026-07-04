"use client";

import {
  Fragment,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
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
import { AlertCircle, AlertTriangle, GripVertical, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { useNotifications } from "@/components/notifications/notification-center";
import { getDayNoteColor } from "@/lib/day-note-colors";
import { cn, parseDateOnly } from "@/lib/utils";
import { validateAssignment, type ScheduleConflict } from "@/lib/schedule-engine";

type Employee = {
  id: string;
  name: string;
  position: string;
  storeIds?: string[];
  maxShiftsPerMonth?: number;
  maxHoursPerMonth?: number;
};

type Shift = {
  id: string;
  storeId: string;
  name: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  durationHours: number;
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
  onLayoutModeChange: (mode: "horizontal" | "vertical") => void;
  canEdit: boolean;
  isAdmin?: boolean;
  onRefresh: () => void;
  onOptimisticUpdate?: (storeId: string, shiftTemplateId: string, date: string, slotIndex: number, employeeId: string | null) => void;
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

function LayoutModeIcon({ mode }: { mode: "horizontal" | "vertical" }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4",
        mode === "horizontal" ? "flex-col justify-between" : "flex-row justify-between"
      )}
      aria-hidden="true"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "rounded-full bg-current",
            mode === "horizontal" ? "h-0.5 w-full" : "h-full w-0.5"
          )}
        />
      ))}
    </span>
  );
}

function LayoutModeActions({
  layoutMode,
  onLayoutModeChange,
}: {
  layoutMode: "horizontal" | "vertical";
  onLayoutModeChange: (mode: "horizontal" | "vertical") => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={layoutMode === "horizontal" ? "default" : "outline"}
        className="h-9 w-9 rounded-xl p-0"
        onClick={() => onLayoutModeChange("horizontal")}
        aria-label="Chuyển sang bảng ngang"
        title="Bảng ngang"
      >
        <LayoutModeIcon mode="horizontal" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={layoutMode === "vertical" ? "default" : "outline"}
        className="h-9 w-9 rounded-xl p-0"
        onClick={() => onLayoutModeChange("vertical")}
        aria-label="Chuyển sang bảng dọc"
        title="Bảng dọc"
      >
        <LayoutModeIcon mode="vertical" />
      </Button>
    </div>
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
        employee ? "border-blue-200 bg-blue-50 assigned-slot" : "border-dashed border-slate-300 bg-slate-50",
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
  flashSlots,
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
  flashSlots: Map<string, "success" | "error">;
  onAssign: (slot: Slot, employeeId: string) => Promise<void>;
  onClear: (slot: Slot) => Promise<void>;
}) {
  const orderedSlots = [...slots].sort((a, b) => a.slotIndex - b.slotIndex);
  const assignedSlots = orderedSlots.filter((slot) => Boolean(slot.employeeId));
  const emptySlots = orderedSlots.filter((slot) => !slot.employeeId);
  const assignedEmployeeIds = new Set(
    assignedSlots
      .map((slot) => slot.employeeId)
      .filter((employeeId): employeeId is string => Boolean(employeeId))
  );
  const availableEmployees = employees.filter(
    (employee) => !assignedEmployeeIds.has(employee.id)
  );
  const hasAssigned = assignedSlots.length > 0;

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
                <CompactAssignedSlotRow
                  key={slotKey(slot)}
                  slot={slot}
                  shift={shift}
                  employee={employee}
                  canEdit={canEdit}
                  loading={loading}
                  flash={flashSlots.get(slotKey(slot))}
                  onClear={() => onClear(slot)}
                />
              );
            })}
          </div>
        </div>
      ) : canEdit ? (
        <p className="mt-1 font-semibold text-slate-400">— Trống —</p>
      ) : (
        <p className="mt-1 font-semibold text-slate-400">— Trống —</p>
      )}

      {canEdit && emptySlots.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {emptySlots.map((slot) => (
            <CompactEmptySlotDropZone
              key={slotKey(slot)}
              slot={slot}
              employees={availableEmployees}
              loading={loading}
              canEdit={canEdit}
              flash={flashSlots.get(slotKey(slot))}
              onAssign={(employeeId) => onAssign(slot, employeeId)}
            />
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

function CompactAssignedSlotRow({
  slot,
  shift,
  employee,
  canEdit,
  loading,
  flash,
  onClear,
}: {
  slot: Slot;
  shift: Shift;
  employee: Employee;
  canEdit: boolean;
  loading: boolean;
  flash?: "success" | "error";
  onClear: () => Promise<void>;
}) {
  const key = slotKey(slot);
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: dragId(key),
    disabled: !canEdit || loading,
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
        "assigned-slot flex items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors duration-200",
        isOver && "ring-2 ring-blue-400",
        isDragging && "opacity-40",
        flash === "success" && "bg-green-100 text-green-900 ring-1 ring-green-400",
        flash === "error" && "bg-rose-100 text-rose-900 ring-1 ring-rose-400"
      )}
    >
      <p className="font-semibold text-slate-900">{employee.name}</p>
      {canEdit && (
        <div className="flex items-center gap-1">
          <button
            ref={setDragRef}
            type="button"
            className="touch-none rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-600"
            {...listeners}
            {...attributes}
            aria-label={`Kéo ${employee.name} để đổi ca ${shift.name}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onClear()}
            disabled={loading}
            className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label={`Xóa ${employee.name} khỏi ${shift.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function CompactEmptySlotDropZone({
  slot,
  employees,
  loading,
  canEdit,
  flash,
  onAssign,
}: {
  slot: Slot;
  employees: Employee[];
  loading: boolean;
  canEdit: boolean;
  flash?: "success" | "error";
  onAssign: (employeeId: string) => Promise<void>;
}) {
  const key = slotKey(slot);
  const { setNodeRef, isOver } = useDroppable({
    id: dropId(key),
    disabled: !canEdit || loading,
    data: { slot },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg transition-colors duration-200",
        isOver && "ring-2 ring-blue-400",
        flash === "success" && "ring-2 ring-green-400",
        flash === "error" && "ring-2 ring-rose-400"
      )}
    >
      <Select
        className="h-8 text-xs"
        value=""
        disabled={loading || employees.length === 0}
        onChange={(e) => {
          const val = e.target.value;
          if (val) void onAssign(val);
        }}
      >
        <option value="">
          {employees.length > 0 ? "— Chọn nhân viên —" : "Không còn nhân viên phù hợp"}
        </option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name}
          </option>
        ))}
      </Select>
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
  onLayoutModeChange,
  canEdit,
  isAdmin,
  onRefresh,
  onOptimisticUpdate,
}: ScheduleCalendarProps) {
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{
    title: string;
    description: string;
    conflicts: ScheduleConflict[];
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
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
  const [flashSlots, setFlashSlots] = useState<Map<string, "success" | "error">>(new Map());
  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();

  const triggerFlash = useCallback((ids: string[], type: "success" | "error") => {
    setFlashSlots(prev => {
      const next = new Map(prev);
      ids.forEach(id => next.set(id, type));
      return next;
    });
    setTimeout(() => {
      setFlashSlots(prev => {
        const next = new Map(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, 1200);
  }, []);

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

    let timeoutId: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updatePlannerMetrics, 150);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" || !plannerTableRef.current
        ? null
        : new ResizeObserver(debouncedUpdate);

    if (resizeObserver && plannerTableRef.current) {
      resizeObserver.observe(plannerTableRef.current);
    }
    if (resizeObserver && plannerScrollRef.current) {
      resizeObserver.observe(plannerScrollRef.current);
    }

    window.addEventListener("resize", debouncedUpdate);
    return () => {
      clearTimeout(timeoutId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", debouncedUpdate);
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
  const visibleGroupKeys = useMemo(() => {
    if (!selectedEmployeeId) {
      return new Set(slotsByGroup.keys());
    }

    const keys = new Set<string>();
    for (const [groupKey, groupSlots] of slotsByGroup.entries()) {
      if (groupSlots.some((slot) => slot.employeeId === selectedEmployeeId)) {
        keys.add(groupKey);
      }
    }
    return keys;
  }, [selectedEmployeeId, slotsByGroup]);
  const visibleDates = useMemo(
    () =>
      selectedEmployeeId
        ? dates.filter((date) =>
            Array.from(visibleGroupKeys).some((groupKey) => groupKey.startsWith(`${date}|`))
          )
        : dates,
    [dates, selectedEmployeeId, visibleGroupKeys]
  );
  const visibleStores = useMemo(() => {
    if (!selectedEmployeeId) return stores;
    const visibleStoreIds = new Set(
      Array.from(visibleGroupKeys).map((groupKey) => groupKey.split("|")[1])
    );
    return stores.filter((store) => visibleStoreIds.has(store.id));
  }, [selectedEmployeeId, stores, visibleGroupKeys]);
  const visibleShiftIdsByStore = useMemo(() => {
    if (!selectedEmployeeId) {
      return new Map(
        stores.map((store) => [store.id, new Set((shiftsByStore.get(store.id) ?? []).map((shift) => shift.id))])
      );
    }

    const map = new Map<string, Set<string>>();
    for (const groupKey of visibleGroupKeys) {
      const [, storeId, shiftTemplateId] = groupKey.split("|");
      const current = map.get(storeId) ?? new Set<string>();
      current.add(shiftTemplateId);
      map.set(storeId, current);
    }
    return map;
  }, [selectedEmployeeId, shiftsByStore, stores, visibleGroupKeys]);

  function checkClientConflicts(
    targetSlot: Slot,
    newEmployeeId: string,
    ignoreSlot?: Slot
  ): ScheduleConflict[] {
    const employee = employees.find((e) => e.id === newEmployeeId);
    if (!employee) return [];

    const allAssignments = slots.map((s) => {
      const isIgnored = ignoreSlot && slotKey(s) === slotKey(ignoreSlot);
      return {
        id: s.assignmentId || Math.random().toString(),
        employeeId: isIgnored ? null : s.employeeId,
        storeId: s.storeId,
        shiftTemplateId: s.shiftTemplateId,
        date: parseDateOnly(s.date),
        slotIndex: s.slotIndex,
        shiftTemplate: shifts.find((sh) => sh.id === s.shiftTemplateId)!,
      };
    });

    const targetDate = parseDateOnly(targetSlot.date);

    return validateAssignment(
      newEmployeeId,
      targetSlot.storeId,
      targetSlot.shiftTemplateId,
      targetDate,
      targetSlot.slotIndex,
      targetSlot.requiredStaff,
      allAssignments as any,
      shifts as any,
      employee as any
    );
  }

  async function assignEmployee(
    slot: Slot,
    employeeId: string | null,
    confirmOverCapacity = false
  ) {
    if (employeeId && !confirmOverCapacity) {
      const conflicts = checkClientConflicts(slot, employeeId);
      if (conflicts.length > 0) {
        const hardConflicts = conflicts.filter((c) => c.type !== "MAX_HOURS" && c.type !== "MAX_SHIFTS");
        if (hardConflicts.length > 0) {
          notify({
            title: "Không thể xếp ca",
            body: hardConflicts[0].message,
            tone: "error",
            dedupeKey: `error-${Date.now()}`,
          });
          return;
        }

        setPendingRequest({
          title: "Xác nhận yêu cầu xếp ca",
          description: "Vượt giới hạn xếp ca",
          conflicts,
          onConfirm: () => {
            setPendingRequest(null);
            void assignEmployee(slot, employeeId, true);
          },
          onCancel: () => {
            setPendingRequest(null);
          },
        });
        return;
      }
    }

    if (onOptimisticUpdate) {
      onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, employeeId);
    }
    
    const employee = employees.find((e) => e.id === employeeId);
    const shift = shifts.find((sh) => sh.id === slot.shiftTemplateId);
    const formattedDate = format(parseDateOnly(slot.date), "dd/MM/yyyy");
    const msg = employee 
      ? `Đã thêm ${employee.name} vào ${shift?.name || "ca"} ngày ${formattedDate}`
      : `Đã xoá phân công ${shift?.name || "ca"} ngày ${formattedDate}`;

    notify({
      title: "Cập nhật thành công",
      body: msg,
      tone: "success",
      dedupeKey: `success-${Date.now()}-${Math.random()}`,
    });
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
        if (onOptimisticUpdate) {
          onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, slot.employeeId);
        }
        setPendingRequest({
          title: "Xác nhận yêu cầu xếp ca",
          description: typeof data.error === "string" ? data.error : "Vượt giới hạn xếp ca",
          conflicts: data.conflicts ?? [],
          onConfirm: () => {
            setPendingRequest(null);
            void assignEmployee(slot, employeeId, true);
          },
          onCancel: () => {
            setPendingRequest(null);
            setConflicts(data.conflicts ?? []);
          },
        });
        return;
      }

      if (!res.ok) {
        if (onOptimisticUpdate) {
          onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, slot.employeeId);
        }
        setConflicts(data.conflicts ?? []);
        setMessageType("error");
        setMessage(typeof data.error === "string" ? data.error : "Không thể cập nhật ca");
        return;
      }

      // Removing success toast to avoid notification delay noise during optimistic updates
      await onRefresh();
    } catch (err) {
      if (onOptimisticUpdate) {
        onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, slot.employeeId);
      }
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
        sourceStoreId: sourceSlot.storeId,
        sourceShiftTemplateId: sourceSlot.shiftTemplateId,
        sourceDate: sourceSlot.date,
        sourceSlotIndex: sourceSlot.slotIndex,
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
    if (!canEdit || isMoving) return;

    const { active, over } = event;
    if (!over) return;

    const sourceSlot = parseDragOrDropId(String(active.id), slots);
    const targetSlot = parseDragOrDropId(String(over.id), slots);

    if (!sourceSlot?.employeeId || !targetSlot) return;
    if (slotKey(sourceSlot) === slotKey(targetSlot)) return;

    const conflictsA = checkClientConflicts(targetSlot, sourceSlot.employeeId, sourceSlot);
    const conflictsB = targetSlot.employeeId ? checkClientConflicts(sourceSlot, targetSlot.employeeId, targetSlot) : [];

    const hardConflictsA = conflictsA.filter((c) => c.type !== "MAX_HOURS" && c.type !== "MAX_SHIFTS");
    const hardConflictsB = conflictsB.filter((c) => c.type !== "MAX_HOURS" && c.type !== "MAX_SHIFTS");

    if (hardConflictsA.length > 0 || hardConflictsB.length > 0) {
      const msg = hardConflictsA.length > 0 ? hardConflictsA[0].message : hardConflictsB[0].message;
      notify({
        title: "Không thể đổi ca",
        body: msg,
        tone: "error",
        dedupeKey: `error-${Date.now()}`,
      });
      triggerFlash([slotKey(sourceSlot), slotKey(targetSlot)], "error");
      return;
    }

    if (onOptimisticUpdate) {
      onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, targetSlot.employeeId ?? null);
      onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, sourceSlot.employeeId);
    }

    setConflicts([]);
    setMessage(null);
    
    const sourceEmployee = employees.find((e) => e.id === sourceSlot.employeeId);
    const targetShift = shifts.find((sh) => sh.id === targetSlot.shiftTemplateId);
    const formattedTargetDate = format(parseDateOnly(targetSlot.date), "dd/MM/yyyy");
    
    notify({
      title: "Cập nhật thành công",
      body: `Đã đổi ${sourceEmployee?.name} sang ${targetShift?.name || "ca"} ngày ${formattedTargetDate}`,
      tone: "success",
      dedupeKey: `success-${Date.now()}-${Math.random()}`,
    });

    setIsMoving(true);
    try {
      triggerFlash([slotKey(sourceSlot), slotKey(targetSlot)], "success");

      const result = await moveAssignment(sourceSlot, targetSlot, true);

      if (!result.ok) {
        if (onOptimisticUpdate) {
          onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, sourceSlot.employeeId);
          onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, targetSlot.employeeId);
        }
        setConflicts(result.data?.conflicts ?? []);
        notify({
          title: "Không thể đổi ca",
          body: result.data?.error || "Đã có lỗi xảy ra",
          tone: "error",
          dedupeKey: `error-${Date.now()}`,
        });
        triggerFlash([slotKey(sourceSlot), slotKey(targetSlot)], "error");
        return;
      }

      if (result.data?.pendingApproval) {
        if (onOptimisticUpdate) {
          onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, sourceSlot.employeeId);
          onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, targetSlot.employeeId);
        }
        notify({
          title: "Chờ xác nhận",
          body: result.data.message || "Đã gửi yêu cầu xác nhận",
          tone: "success",
        });
      }

      // Removing success toast to avoid notification delay noise during optimistic updates
      await onRefresh();
    } catch (err) {
      if (onOptimisticUpdate) {
        onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, sourceSlot.employeeId);
        onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, targetSlot.employeeId);
      }
      triggerFlash([slotKey(sourceSlot), slotKey(targetSlot)], "error");
    } finally {
      setIsMoving(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const slot = parseDragOrDropId(String(event.active.id), slots);
    if (slot?.employeeId) setActiveSlot(slot);
  }

  const activeEmployee = activeSlot ? employeeMap.get(activeSlot.employeeId ?? "") : null;

  useEffect(() => {
    if (unfilled.length === 0 || !canEdit) return;
    notify({
      title: `Còn ${unfilled.length} ca trống`,
      body: "Chọn nhân viên hoặc xếp tự động.",
      tone: "warning",
      dedupeKey: `schedule-unfilled|${unfilled.length}`,
    });
  }, [notify, unfilled.length]);

  useEffect(() => {
    if (conflicts.length === 0) return;
    notify({
      title: "Xung đột xếp ca",
      body: conflicts.slice(0, 3).map((conflict) => conflict.message).join(" "),
      tone: "error",
      dedupeKey: `schedule-conflicts|${conflicts.map((conflict) => conflict.message).join("|")}`,
    });
  }, [conflicts, notify]);

  useEffect(() => {
    if (!message) return;
    notify({
      title: messageType === "success" ? "Cập nhật thành công" : "Không thể cập nhật",
      body: message,
      tone: messageType === "success" ? "success" : "error",
      dedupeKey: `schedule-message|${messageType}|${message}`,
    });
    setMessage(null);
  }, [message, messageType, notify]);

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
          <p className="font-medium">
            {canEdit ? "Chưa có ca nào để xếp." : "Chưa có ca nào trong khoảng đang xem."}
          </p>
          <p className="mt-1 text-sm">
            {canEdit ? (
              <>
                Vào <strong>Cấu hình ca</strong> để thiết lập ca cho cửa hàng.
              </>
            ) : (
              "Đổi bộ lọc ngày/tháng hoặc cửa hàng để xem lịch khác."
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (selectedEmployeeId && visibleGroupKeys.size === 0) {
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
    <div className={cn("space-y-4", isMoving && "[&_.assigned-slot]:opacity-50 [&_.assigned-slot]:pointer-events-none")}>
      {canEdit && (
        <p className="text-sm text-slate-600">
          Chọn nhân viên từ dropdown, kéo biểu tượng <GripVertical className="inline h-3 w-3" /> để đổi ca,
          hoặc bấm <X className="inline h-3 w-3" /> để xóa nhân viên khỏi ca. Giữ <strong>R</strong> rồi kéo chuột để di chuyển bảng ngang.
        </p>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {layoutMode === "horizontal" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Lịch xếp ca dạng bảng ngang</CardTitle>
            <LayoutModeActions
              layoutMode={layoutMode}
              onLayoutModeChange={onLayoutModeChange}
            />
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
                                visibleGroupKeys.has(`${date}|${store.id}|${shift.id}`);
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
                                        flashSlots={flashSlots}
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Lịch xếp ca dạng bảng dọc</CardTitle>
                <LayoutModeActions
                  layoutMode={layoutMode}
                  onLayoutModeChange={onLayoutModeChange}
                />
              </CardHeader>
            </Card>
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
                                  !visibleGroupKeys.has(`${date}|${store.id}|${shift.id}`))
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
                                  flashSlots={flashSlots}
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

        <DragOverlay dropAnimation={null}>
          {activeEmployee ? (
            layoutMode === "horizontal" ? (
              <div className="flex min-w-[120px] items-center justify-between gap-2 rounded-md bg-blue-100 px-1 py-0.5 opacity-90 shadow-lg ring-1 ring-blue-400">
                <p className="text-xs font-semibold text-slate-900">{activeEmployee.name}</p>
              </div>
            ) : (
              <div className="min-w-[180px] rounded-lg border border-blue-400 bg-card p-2 text-xs opacity-90 shadow-lg ring-2 ring-blue-400">
                <p className="font-medium text-slate-800">{activeEmployee.name}</p>
              </div>
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Full-screen Modal for Scheduler sending request */}
      {pendingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl shadow-2xl">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <CardTitle className="text-xl text-blue-700">{pendingRequest.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <p className="text-lg font-medium text-slate-800">{pendingRequest.description}</p>
                <p className="text-sm text-slate-500">
                  Hành động này vượt quá giới hạn đã được thiết lập.
                  {!isAdmin && " Một yêu cầu duyệt sẽ được gửi tới quản lý."}
                </p>
              </div>

              {pendingRequest.conflicts && pendingRequest.conflicts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h4 className="mb-2 font-semibold text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Chi tiết cảnh báo / Vượt giới hạn
                  </h4>
                  <ul className="space-y-2 text-sm text-amber-700">
                    {pendingRequest.conflicts.map((conflict, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1 flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{conflict.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={pendingRequest.onCancel}
                  disabled={loading}
                >
                  Huỷ bỏ
                </Button>
                <Button
                  onClick={pendingRequest.onConfirm}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? "Đang xử lý..." : isAdmin ? "Xác nhận" : "Gửi yêu cầu duyệt"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
