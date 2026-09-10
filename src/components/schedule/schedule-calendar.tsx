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
import Link from "next/link";
import { AlertCircle, AlertTriangle, GripVertical, X, Plus, ArrowRight } from "lucide-react";
import { FaultModal } from "./fault-modal";
import { OvertimeModal } from "./overtime-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { useNotifications } from "@/components/notifications/notification-center";
import { getDayNoteColor } from "@/lib/day-note-colors";
import { cn, parseDateOnly, formatDateOnly } from "@/lib/utils";
import { validateAssignment, type ScheduleConflict } from "@/lib/schedule-engine";

type Employee = {
  id: string;
  name: string;
  position: string;
  storeIds?: string[];
  maxShiftsPerMonth?: number;
  maxHoursPerMonth?: number;
  isActive?: boolean;
  deletedAt?: string | null;
  currentMonthHours?: number;
  currentMonthShifts?: number;
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

type Store = { id: string; name: string; logoUrl?: string; maxHoursPerDay?: number | null; maxShiftsPerDay?: number | null; };

type Slot = {
  storeId: string;
  shiftTemplateId: string;
  date: string;
  slotIndex: number;
  requiredStaff: number;
  employeeId: string | null;
  assignmentId?: string;
  faults?: { id: string; note: string | null; evidenceUrl: string | null; createdAt: Date | string }[];
};

type DayNote = {
  id?: string;
  date: string;
  note: string;
  colorKey?: string;
};

type Unfilled = { storeName: string; shiftName: string; date: string };
type ScheduleCalendarProps = {
  companyId?: string;
  stores: Store[];
  shifts: Shift[];
  slots: Slot[];
  employees: Employee[];
  dayNotes: DayNote[];
  overtimes: { id: string; storeId: string; shiftTemplateId: string; date: string; employeeId: string; hours: number }[];
  unfilled: Unfilled[];
  selectedEmployeeId?: string;
  selectedEmployeeIds?: string[];
  selectedStoreIds?: string[];
  layoutMode: "horizontal" | "vertical";
  onLayoutModeChange: (mode: "horizontal" | "vertical") => void;
  canEdit: boolean;
  canEditPast?: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
  onOptimisticUpdate: (
    storeId: string,
    shiftTemplateId: string,
    date: string,
    slotIndex: number,
    employeeId: string | null
  ) => void;
  onOptimisticOvertimeUpdate?: (
    action: "add" | "edit" | "delete",
    payload: { id?: string; storeId?: string; shiftTemplateId?: string; date?: string; employeeId?: string; hours?: number }
  ) => void;
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
  onAddFault,
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
  onAddFault: (slot: Slot) => void;
}) {
  const key = slotKey(slot);
  const slotDate = new Date(slot.date);
  slotDate.setHours(0, 0, 0, 0);

  const eligible = employees.filter((e) => {
    if (e.storeIds && !e.storeIds.includes(slot.storeId)) return false;
    if (!e.deletedAt) return true;
    const deletedDate = new Date(e.deletedAt);
    deletedDate.setHours(0, 0, 0, 0);
    return slotDate <= deletedDate;
  });

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
        employee
          ? "border-slate-300/80 bg-[#EDF2F7] shadow-xs dark:border-[#333333] dark:bg-[#252526] assigned-slot"
          : "border-dashed border-slate-300/80 bg-slate-50 dark:border-[#333333] dark:bg-[#1E1E1E]",
        isOver && canEdit && "ring-2 ring-blue-400",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white truncate">
            {shift?.name} ({shift?.startTime}-{shift?.endTime})
          </p>
          <p className="text-slate-500 dark:text-[#9D9D9D] font-semibold truncate">{store.name}</p>
        </div>
        {canEdit && employee && (
          <div className="flex items-center gap-0.5 shrink-0 ml-1">
            <button
              type="button"
              onClick={() => onAddFault(slot)}
              disabled={loading}
              className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-[#37373D] dark:hover:text-white transition-colors"
              aria-label="Thêm lỗi nhân viên"
              title="Thêm lỗi nhân viên"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              ref={setDragRef}
              type="button"
              className="touch-none rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-[#37373D] dark:hover:text-white cursor-grab active:cursor-grabbing transition-colors"
              {...listeners}
              {...attributes}
              aria-label="Kéo để đổi ca"
              title="Kéo để đổi ca"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {employee ? (
        <div className="mt-1.5 flex items-center justify-between gap-1 min-w-0 rounded-lg bg-white border border-slate-300/90 px-2 py-1 shadow-xs dark:bg-[#2D2D30] dark:border-[#3C3C3C]">
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden pr-1">
            <p className="font-bold text-slate-900 dark:text-white truncate" title={employee.name}>{employee.name}</p>
            {slot.faults && slot.faults.length > 0 && (
              <button 
                type="button"
                onClick={() => onAddFault(slot)}
                className="flex items-center gap-0.5 text-[10px] text-red-500 dark:text-red-400 font-medium mt-0.5 hover:underline text-left cursor-pointer truncate"
                aria-label="Xem chi tiết lỗi"
              >
                <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">lỗi : {slot.faults.length}</span>
              </button>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-0.5 shrink-0 ml-1">
              <button
                type="button"
                onClick={() => onClear()}
                disabled={loading}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-red-500 dark:hover:bg-rose-950/40 dark:hover:text-red-400 transition-colors"
                aria-label="Xóa phân công"
                title="Xóa phân công"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : canEdit ? (
        <Select
          className="mt-1 h-8 text-xs w-full"
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
        <p className="mt-1 font-semibold text-slate-400 dark:text-neutral-400">— Trống —</p>
      )}

      <Badge
        variant={slot.requiredStaff <= 1 ? "warning" : "default"}
        className={cn(
          "mt-1 text-[10px] truncate",
          slot.requiredStaff > 1 && "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800/80 dark:bg-rose-950/70 dark:text-rose-300"
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
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-neutral-700 dark:bg-[#18181B]",
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
            "text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-neutral-400",
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
  overtimes,
  onAddOvertime,
  onEditOvertime,
  onDeleteOvertime,
  onAssign,
  onClear,
  onAddFault,
}: {
  slots: Slot[];
  shift: Shift;
  store: Store;
  employeeMap: Map<string, Employee>;
  employees: Employee[];
  canEdit: boolean;
  loading: boolean;
  flashSlots: Map<string, "success" | "error">;
  overtimes: { id: string; employeeId: string; hours: number }[];
  onAddOvertime: () => void;
  onEditOvertime: (id: string, employeeId: string, hours: number) => void;
  onDeleteOvertime: (id: string) => void;
  onAssign: (slot: Slot, employeeId: string) => Promise<void>;
  onClear: (slot: Slot) => Promise<void>;
  onAddFault: (slot: Slot) => void;
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
        "rounded-xl border p-2 sm:p-2.5 text-xs transition-colors flex flex-col justify-between min-w-0 overflow-hidden",
        hasAssigned
          ? "border-slate-300/80 bg-[#EDF2F7] shadow-xs dark:border-[#333333] dark:bg-[#252526]"
          : "border-dashed border-slate-300/80 bg-slate-50/70 dark:border-[#333333] dark:bg-[#1E1E1E]"
      )}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 text-xs truncate dark:text-white">{shift.name}</p>
          <p className="text-[10px] sm:text-[11px] font-mono font-medium text-slate-500 truncate dark:text-[#CCCCCC]">
            {shift.startTime}-{shift.endTime}
          </p>
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 truncate dark:text-[#9D9D9D] uppercase tracking-tight">{store.name}</p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddOvertime}
            disabled={!hasAssigned || loading}
            className="h-5 w-5 sm:h-6 sm:w-6 p-0 shrink-0 rounded-md text-slate-400 hover:text-slate-900 hover:bg-white hover:shadow-xs focus-visible:ring-1 focus-visible:ring-slate-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all dark:text-[#9D9D9D] dark:hover:text-white dark:hover:bg-[#2D2D30]"
            title={!hasAssigned ? "Ca trống không thể thêm giờ làm thêm" : "Thêm giờ làm thêm"}
          >
            <Plus className="h-3 w-3 sm:h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {assignedSlots.length > 0 ? (
        <div className="mt-1.5 space-y-1 min-w-0">
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
                  onAddFault={() => onAddFault(slot)}
                />
              );
            })}
          </div>
          {overtimes.length > 0 && (
            <div className="min-w-0 flex-1 space-y-0.5 pt-1 border-t border-slate-200/60 dark:border-neutral-700/60">
              {overtimes.map((ot) => {
                const emp = employeeMap.get(ot.employeeId);
                if (!emp) return null;
                return (
                  <div key={ot.id} className="group/ot flex items-center justify-between text-[11px] italic text-slate-500 dark:text-neutral-300 min-w-0">
                    <span className="truncate">{emp.name} +{ot.hours}h</span>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/ot:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onEditOvertime(ot.id, ot.employeeId, ot.hours)}
                          disabled={loading}
                          className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-0.5"
                          title="Sửa giờ làm thêm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteOvertime(ot.id)}
                          disabled={loading}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-0.5"
                          title="Xoá giờ làm thêm"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : canEdit ? (
        <p className="mt-1.5 text-[11px] font-medium text-slate-400 dark:text-neutral-400 italic">— Trống —</p>
      ) : (
        <p className="mt-1.5 text-[11px] font-medium text-slate-400 dark:text-neutral-400 italic">— Trống —</p>
      )}

      {canEdit && emptySlots.length > 0 && (
        <div className="mt-1.5 space-y-1.5 min-w-0">
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

      <div className="mt-2 pt-1 border-t border-slate-200/50 dark:border-neutral-800 flex items-center justify-between min-w-0">
        <Badge
          variant={slots[0]?.requiredStaff <= 1 ? "warning" : "default"}
          className={cn(
            "text-[10px] px-1.5 py-0.5 truncate",
            (slots[0]?.requiredStaff ?? slots.length) > 1 &&
              "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800/80 dark:bg-rose-950/70 dark:text-rose-300"
          )}
        >
          {slots[0]?.requiredStaff ?? slots.length} người/ca
          {(slots[0]?.requiredStaff ?? slots.length) > 1
            ? ` · ${assignedSlots.length} đã xếp`
            : ""}
        </Badge>
      </div>
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
  onAddFault,
}: {
  slot: Slot;
  shift: Shift;
  employee: Employee;
  canEdit: boolean;
  loading: boolean;
  flash?: "success" | "error";
  onClear: () => Promise<void>;
  onAddFault: (slot: Slot) => void;
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
        "assigned-slot group/slot flex items-center justify-between gap-1 rounded-lg bg-white hover:bg-white border border-slate-300/90 px-1.5 py-1 sm:px-2 sm:py-1 shadow-xs hover:shadow transition-all duration-150 min-w-0 overflow-hidden dark:bg-[#2D2D30] dark:hover:bg-[#37373D] dark:border-[#3C3C3C] dark:shadow-xs",
        isOver && "ring-2 ring-slate-400 bg-blue-50/60 dark:bg-[#37373D] dark:ring-neutral-400",
        isDragging && "opacity-40",
        flash === "success" && "bg-green-100 text-green-900 ring-1 ring-green-400 dark:bg-green-950 dark:text-green-200",
        flash === "error" && "bg-rose-100 text-rose-900 ring-1 ring-rose-400 dark:bg-rose-950 dark:text-rose-200"
      )}
    >
      <div className="flex flex-col justify-center min-w-0 flex-1 overflow-hidden pr-0.5">
        <p className="font-bold text-slate-900 text-[11px] sm:text-xs truncate dark:text-white" title={employee.name}>
          {employee.name}
        </p>
        {slot.faults && slot.faults.length > 0 && (
          <button 
            type="button"
            onClick={() => onAddFault(slot)}
            className="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-red-500 dark:text-red-400 font-medium hover:underline text-left cursor-pointer truncate"
            aria-label="Xem chi tiết lỗi"
          >
            <AlertTriangle className="h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0" />
            <span className="truncate">lỗi : {slot.faults.length}</span>
          </button>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center gap-0.5 shrink-0 ml-0.5">
          <button
            type="button"
            onClick={() => onAddFault(slot)}
            disabled={loading}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#45454C] dark:hover:text-white shrink-0 transition-colors"
            aria-label={`Thêm lỗi cho ${employee.name}`}
            title={`Thêm lỗi cho ${employee.name}`}
          >
            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </button>
          <button
            ref={setDragRef}
            type="button"
            className="touch-none rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#45454C] dark:hover:text-white shrink-0 cursor-grab active:cursor-grabbing transition-colors"
            {...listeners}
            {...attributes}
            aria-label={`Kéo ${employee.name} để đổi ca ${shift.name}`}
            title={`Kéo ${employee.name} để đổi ca`}
          >
            <GripVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onClear()}
            disabled={loading}
            className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-red-500 dark:hover:bg-rose-950/60 dark:hover:text-red-400 shrink-0 transition-colors"
            aria-label={`Xóa ${employee.name} khỏi ${shift.name}`}
            title={`Xóa khỏi ca ${shift.name}`}
          >
            <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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

  const slotDate = new Date(slot.date);
  slotDate.setHours(0, 0, 0, 0);

  const filteredEmployees = employees.filter((employee) => {
    if (!employee.deletedAt) return true;
    const deletedDate = new Date(employee.deletedAt);
    deletedDate.setHours(0, 0, 0, 0);
    // If deletedDate is 5/7, and slotDate is 6/7, then slotDate > deletedDate (exclude)
    // If slotDate is 5/7, slotDate <= deletedDate (include)
    return slotDate <= deletedDate;
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
        className="h-7 sm:h-8 text-[10px] sm:text-xs px-1 sm:px-2"
        value=""
        disabled={loading || filteredEmployees.length === 0}
        onChange={(e) => {
          const val = e.target.value;
          if (val) void onAssign(val);
        }}
      >
        <option value="">
          {filteredEmployees.length > 0 ? "— Chọn NV —" : "Hết NV phù hợp"}
        </option>
        {filteredEmployees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function ScheduleCalendar({
  companyId,
  stores,
  shifts,
  slots,
  employees,
  dayNotes,
  overtimes,
  unfilled,
  selectedEmployeeId = "",
  selectedEmployeeIds = [],
  selectedStoreIds = [],
  layoutMode,
  onLayoutModeChange,
  canEdit,
  canEditPast = true,
  isAdmin,
  onRefresh,
  onOptimisticUpdate,
  onOptimisticOvertimeUpdate,
}: ScheduleCalendarProps) {
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [faultSlot, setFaultSlot] = useState<Slot | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const targetEmployeeIds = useMemo(() => {
    if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
      return selectedEmployeeIds;
    }
    if (selectedEmployeeId) {
      return [selectedEmployeeId];
    }
    return [];
  }, [selectedEmployeeIds, selectedEmployeeId]);

  const hasEmployeeFilter = targetEmployeeIds.length > 0;
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
  const [activeScrollDate, setActiveScrollDate] = useState<string>("");
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

  const handleSaveFault = async (note: string, evidenceUrl?: string, time?: string) => {
    if (!faultSlot?.assignmentId || !faultSlot?.employeeId) return;
    try {
      setLoading(true);
      
      let createdAt = undefined;
      if (time && faultSlot.date) {
        const [hours, minutes] = time.split(':');
        const dt = new Date(faultSlot.date);
        dt.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        createdAt = dt.toISOString();
      }

      const res = await fetch("/api/schedule/fault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: faultSlot.assignmentId,
          employeeId: faultSlot.employeeId,
          note,
          evidenceUrl,
          createdAt,
        }),
      });
      if (!res.ok) throw new Error("Lỗi khi thêm");
      notify({ title: "Thành công", body: "Đã thêm lỗi thành công", tone: "success" });
      onRefresh();
    } catch (error: any) {
      notify({ title: "Lỗi", body: error.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditFault = async (id: string, note: string, evidenceUrl?: string, time?: string) => {
    try {
      setLoading(true);

      let createdAt = undefined;
      if (time && faultSlot?.date) {
        const [hours, minutes] = time.split(':');
        const dt = new Date(faultSlot.date);
        dt.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        createdAt = dt.toISOString();
      }

      const res = await fetch("/api/schedule/fault", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, note, evidenceUrl, createdAt }),
      });
      if (!res.ok) throw new Error("Lỗi khi cập nhật");
      notify({ title: "Thành công", body: "Đã cập nhật lỗi thành công", tone: "success" });
      onRefresh();
    } catch (error: any) {
      notify({ title: "Lỗi", body: error.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFault = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/schedule/fault?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Lỗi khi xóa");
      const data = await res.json();
      if (data.pendingApproval) {
        notify({ title: "Đã gửi yêu cầu", body: "Yêu cầu xoá lỗi đã được gửi đến Quản lý để duyệt", tone: "warning" });
      } else {
        notify({ title: "Thành công", body: "Đã xóa lỗi thành công", tone: "success" });
        onRefresh();
      }
    } catch (error: any) {
      notify({ title: "Lỗi", body: error.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

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

  const syncFromMain = useCallback(() => {
    const mainScroller = plannerScrollRef.current;
    if (!mainScroller) return;

    const scrollLeft = mainScroller.scrollLeft;
    setPlannerScrollLeft(scrollLeft);
    setPlannerViewportWidth(mainScroller.clientWidth);

    // Tự động phát hiện ngày đang hiển thị ngay sát mép cột cố định bên trái (sticky column)
    if (plannerTableRef.current) {
      const stickyTh = plannerTableRef.current.querySelector("thead tr th:first-child") as HTMLElement | null;
      const dateHeaders = plannerTableRef.current.querySelectorAll<HTMLElement>("thead tr th[data-date]");

      let foundDate: string | null = null;

      if (stickyTh && dateHeaders.length > 0) {
        const stickyRect = stickyTh.getBoundingClientRect();
        // Điểm thăm dò probeX: 40px bên phải mép phải cột sticky (cột ngày hiển thị chính yếu ngay sau cột cố định)
        const probeX = stickyRect.right + 40;

        for (let i = 0; i < dateHeaders.length; i++) {
          const el = dateHeaders[i];
          const rect = el.getBoundingClientRect();
          if (rect.left <= probeX && rect.right > probeX) {
            foundDate = el.getAttribute("data-date");
            break;
          }
        }

        // Dự phòng 1: Nếu probeX nằm ngoài phạm vi, tìm cột đầu tiên có hơn 40px còn hiển thị
        if (!foundDate) {
          for (let i = 0; i < dateHeaders.length; i++) {
            const el = dateHeaders[i];
            const rect = el.getBoundingClientRect();
            if (rect.right > stickyRect.right + 40) {
              foundDate = el.getAttribute("data-date");
              break;
            }
          }
        }
      }

      // Dự phòng 2: Tính toán dựa trên scrollLeft và offsetWidth của các cột ngày
      if (!foundDate && dateHeaders.length > 0) {
        const firstCol = dateHeaders[0];
        const colWidth = firstCol ? firstCol.offsetWidth : 160;
        const colIndex = Math.min(
          Math.max(0, Math.floor((scrollLeft + 40) / (colWidth || 160))),
          dateHeaders.length - 1
        );
        foundDate = dateHeaders[colIndex]?.getAttribute("data-date") || null;
      }

      if (foundDate) {
        setActiveScrollDate((prev) => (prev !== foundDate ? foundDate : prev));
      }
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!panStateRef.current || !plannerScrollRef.current) return;

      const deltaX = event.clientX - panStateRef.current.startX;
      const deltaY = event.clientY - panStateRef.current.startY;
      plannerScrollRef.current.scrollLeft = panStateRef.current.scrollLeft - deltaX;
      plannerScrollRef.current.scrollTop = panStateRef.current.scrollTop - deltaY;
      syncFromMain();
    };

    const handleMouseUp = () => {
      panStateRef.current = null;
      setIsPanning(false);
      syncFromMain();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [syncFromMain]);

  useEffect(() => {
    const updatePlannerMetrics = () => {
      setPlannerContentWidth(plannerTableRef.current?.scrollWidth ?? 0);
      setPlannerViewportWidth(plannerScrollRef.current?.clientWidth ?? 0);
      setPlannerScrollLeft(plannerScrollRef.current?.scrollLeft ?? 0);
      syncFromMain();
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
  }, [stores.length, shifts.length, slots.length, layoutMode, syncFromMain]);

  useEffect(() => {
    const mainScroller = plannerScrollRef.current;
    if (!mainScroller) return;

    mainScroller.addEventListener("scroll", syncFromMain, { passive: true });
    syncFromMain();

    return () => {
      mainScroller.removeEventListener("scroll", syncFromMain);
    };
  }, [syncFromMain, plannerContentWidth, layoutMode]);

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
    if (!hasEmployeeFilter) {
      return new Set(slotsByGroup.keys());
    }

    const keys = new Set<string>();
    for (const [groupKey, groupSlots] of slotsByGroup.entries()) {
      if (groupSlots.some((slot) => slot.employeeId && targetEmployeeIds.includes(slot.employeeId))) {
        keys.add(groupKey);
      }
    }
    return keys;
  }, [hasEmployeeFilter, targetEmployeeIds, slotsByGroup]);

  const visibleDates = useMemo(
    () =>
      hasEmployeeFilter
        ? dates.filter((date) =>
            Array.from(visibleGroupKeys).some((groupKey) => groupKey.startsWith(`${date}|`))
          )
        : dates,
    [dates, hasEmployeeFilter, visibleGroupKeys]
  );

  const visibleStores = useMemo(() => {
    let result = stores;
    if (selectedStoreIds && selectedStoreIds.length > 0) {
      result = result.filter((store) => selectedStoreIds.includes(store.id));
    }
    if (!hasEmployeeFilter) return result;
    const visibleStoreIds = new Set(
      Array.from(visibleGroupKeys).map((groupKey) => groupKey.split("|")[1])
    );
    return result.filter((store) => visibleStoreIds.has(store.id));
  }, [hasEmployeeFilter, stores, selectedStoreIds, visibleGroupKeys]);

  const visibleShiftIdsByStore = useMemo(() => {
    if (!hasEmployeeFilter) {
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
  }, [hasEmployeeFilter, shiftsByStore, stores, visibleGroupKeys]);

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

    const store = stores.find(s => s.id === targetSlot.storeId);
    const storeConfig = store ? { maxShiftsPerDay: store.maxShiftsPerDay ?? null, maxHoursPerDay: store.maxHoursPerDay ?? null } : undefined;

    let conflicts = validateAssignment(
      newEmployeeId,
      targetSlot.storeId,
      targetSlot.shiftTemplateId,
      targetDate,
      targetSlot.slotIndex,
      targetSlot.requiredStaff,
      allAssignments as any,
      shifts as any,
      employee as any,
      storeConfig
    ).filter(c => c.type !== "MONTHLY_MAX_HOURS" && c.type !== "MONTHLY_MAX_SHIFTS");

    if (employee.maxHoursPerMonth !== undefined && employee.currentMonthHours !== undefined) {
      const targetShift = shifts.find((sh) => sh.id === targetSlot.shiftTemplateId);
      const sourceShift = ignoreSlot ? shifts.find((sh) => sh.id === ignoreSlot.shiftTemplateId) : null;
      
      let sourceDuration = 0;
      if (ignoreSlot && ignoreSlot.employeeId === newEmployeeId && sourceShift) {
        sourceDuration = sourceShift.durationHours;
      }

      if (targetShift) {
        const newTotalHours = employee.currentMonthHours + targetShift.durationHours - sourceDuration;
        if (newTotalHours > employee.maxHoursPerMonth && newTotalHours > employee.currentMonthHours) {
          const exceededHours = newTotalHours - employee.maxHoursPerMonth;
          conflicts.push({
            type: "MONTHLY_MAX_HOURS",
            message: `Vượt số giờ tối đa/tháng (${employee.maxHoursPerMonth}h). Số giờ đã vượt trong tháng: ${exceededHours} giờ`,
            employeeId: newEmployeeId,
            date: formatDateOnly(targetDate),
          } as ScheduleConflict);
        }
      }
    }

    if (employee.maxShiftsPerMonth !== undefined && employee.currentMonthShifts !== undefined) {
      let sourceShifts = 0;
      if (ignoreSlot && ignoreSlot.employeeId === newEmployeeId) {
        sourceShifts = 1;
      }
      
      const newTotalShifts = employee.currentMonthShifts + 1 - sourceShifts;
      if (newTotalShifts > employee.maxShiftsPerMonth && newTotalShifts > employee.currentMonthShifts) {
        const exceededShifts = newTotalShifts - employee.maxShiftsPerMonth;
        conflicts.push({
          type: "MONTHLY_MAX_SHIFTS",
          message: `Vượt số ca tối đa/tháng (${employee.maxShiftsPerMonth} ca). Số ca đã vượt trong tháng: ${exceededShifts} ca`,
          employeeId: newEmployeeId,
          date: formatDateOnly(targetDate),
        } as ScheduleConflict);
      }
    }

    return conflicts;
  }

  async function assignEmployee(
    slot: Slot,
    employeeId: string | null,
    confirmOverCapacity = false
  ) {
    if (!canEditPast && slot.date < todayStr) {
      notify({
        title: "Không thể chỉnh sửa ca",
        body: "Bạn không có quyền chỉnh sửa ca làm việc trong quá khứ.",
        tone: "error",
      });
      return;
    }

    if (employeeId && !confirmOverCapacity) {
      const conflicts = checkClientConflicts(slot, employeeId);
      if (conflicts.length > 0) {
        const allowedTypes = ["MONTHLY_MAX_HOURS", "MONTHLY_MAX_SHIFTS", "DAILY_MAX_HOURS", "DAILY_MAX_SHIFTS"];
        const hardConflicts = conflicts.filter((c) => !allowedTypes.includes(c.type));
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
          title: "Gửi yêu cầu xác nhận xếp ca",
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

    const shouldOptimisticUpdate = employeeId ? (!confirmOverCapacity) : true;
    if (shouldOptimisticUpdate && onOptimisticUpdate) {
      onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, employeeId);
    }

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
        if (shouldOptimisticUpdate && onOptimisticUpdate) {
          onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, slot.employeeId);
        }
        setPendingRequest({
          title: "Gửi yêu cầu xác nhận xếp ca",
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
        if (shouldOptimisticUpdate && onOptimisticUpdate) {
          onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, slot.employeeId);
        }
        setConflicts(data.conflicts ?? []);
        setMessageType("error");
        setMessage(typeof data.error === "string" ? data.error : "Không thể cập nhật ca");
        return;
      }

      if (data.pendingApproval) {
        if (shouldOptimisticUpdate && onOptimisticUpdate) {
          onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, slot.employeeId);
        }
        notify({
          title: "Chờ xác nhận",
          body: data.message || "Đã gửi yêu cầu xác nhận",
          tone: "warning",
        });
      } else {
        if (!shouldOptimisticUpdate && onOptimisticUpdate) {
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
      }

      await onRefresh();
    } catch (err) {
      if (shouldOptimisticUpdate && onOptimisticUpdate) {
        onOptimisticUpdate(slot.storeId, slot.shiftTemplateId, slot.date, slot.slotIndex, slot.employeeId);
      }
      console.error(err);
    }
  }


  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [overtimeModalMode, setOvertimeModalMode] = useState<"add" | "edit">("add");
  const [overtimeSlotContext, setOvertimeSlotContext] = useState<{ storeId: string; shiftTemplateId: string; date: string } | null>(null);
  const [editingOvertimeId, setEditingOvertimeId] = useState<string | null>(null);
  const [editingOvertimeInitialHours, setEditingOvertimeInitialHours] = useState<number | undefined>(undefined);
  const [editingOvertimeEmployeeId, setEditingOvertimeEmployeeId] = useState<string | undefined>(undefined);
  const [confirmingDeleteOvertimeId, setConfirmingDeleteOvertimeId] = useState<string | null>(null);

  async function submitOvertime(employeeId: string, hours: number) {
    if (!overtimeSlotContext && overtimeModalMode === "add") return;

    if (!canEditPast) {
      if (overtimeModalMode === "add" && overtimeSlotContext && overtimeSlotContext.date < todayStr) {
        notify({ title: "Không thể thêm giờ làm thêm", body: "Bạn không có quyền chỉnh sửa ca làm việc trong quá khứ.", tone: "error" });
        return;
      }
      if (overtimeModalMode === "edit" && editingOvertimeId) {
        const targetOt = overtimes.find((ot) => ot.id === editingOvertimeId);
        if (targetOt && targetOt.date < todayStr) {
          notify({ title: "Không thể chỉnh sửa giờ làm thêm", body: "Bạn không có quyền chỉnh sửa ca làm việc trong quá khứ.", tone: "error" });
          return;
        }
      }
    }
    
    try {
      const url = overtimeModalMode === "add" ? "/api/schedule/overtime" : `/api/schedule/overtime/${editingOvertimeId}`;
      const method = overtimeModalMode === "add" ? "POST" : "PUT";
      const body = overtimeModalMode === "add" 
        ? { ...overtimeSlotContext, employeeId, hours }
        : { hours };
        
      if (isAdmin && onOptimisticOvertimeUpdate) {
        if (overtimeModalMode === "add" && overtimeSlotContext) {
          onOptimisticOvertimeUpdate("add", {
            storeId: overtimeSlotContext.storeId,
            shiftTemplateId: overtimeSlotContext.shiftTemplateId,
            date: overtimeSlotContext.date,
            employeeId,
            hours,
          });
        } else if (overtimeModalMode === "edit" && editingOvertimeId) {
          onOptimisticOvertimeUpdate("edit", { id: editingOvertimeId, hours });
        }
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (!res.ok) {
        notify({ title: "Lỗi", body: data.error || "Không thể lưu giờ làm thêm", tone: "error" });
        return;
      }
      
      if (data.pendingApproval) {
        notify({ title: "Chờ duyệt", body: data.message, tone: "warning" });
      } else {
        notify({ title: "Thành công", body: "Đã lưu giờ làm thêm", tone: "success" });
      }
      setOvertimeModalOpen(false);
      onRefresh();
    } catch (e) {
      notify({ title: "Lỗi", body: "Không kết nối được server", tone: "error" });
    }
  }

  function deleteOvertime(id: string) {
    setConfirmingDeleteOvertimeId(id);
  }

  async function confirmDeleteOvertime() {
    if (!confirmingDeleteOvertimeId) return;
    const id = confirmingDeleteOvertimeId;
    setConfirmingDeleteOvertimeId(null);

    if (!canEditPast) {
      const targetOt = overtimes.find((ot) => ot.id === id);
      if (targetOt && targetOt.date < todayStr) {
        notify({ title: "Không thể xoá giờ làm thêm", body: "Bạn không có quyền chỉnh sửa ca làm việc trong quá khứ.", tone: "error" });
        return;
      }
    }

    if (isAdmin && onOptimisticOvertimeUpdate) {
      onOptimisticOvertimeUpdate("delete", { id });
    }

    try {
      const res = await fetch(`/api/schedule/overtime/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        notify({ title: "Lỗi", body: data.error || "Không thể xoá", tone: "error" });
        return;
      }
      if (data.pendingApproval) {
        notify({ title: "Chờ duyệt", body: data.message, tone: "warning" });
      } else {
        notify({ title: "Thành công", body: "Đã xoá giờ làm thêm", tone: "success" });
      }
      onRefresh();
    } catch (e) {
      notify({ title: "Lỗi", body: "Không kết nối được server", tone: "error" });
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

    if (!canEditPast && (sourceSlot.date < todayStr || targetSlot.date < todayStr)) {
      notify({
        title: "Không thể đổi ca",
        body: "Bạn không có quyền chỉnh sửa ca làm việc trong quá khứ.",
        tone: "error",
      });
      return;
    }

    const conflictsA = checkClientConflicts(targetSlot, sourceSlot.employeeId, sourceSlot);
    const conflictsB = targetSlot.employeeId ? checkClientConflicts(sourceSlot, targetSlot.employeeId, targetSlot) : [];

    const allowedTypes = ["MONTHLY_MAX_HOURS", "MONTHLY_MAX_SHIFTS", "DAILY_MAX_HOURS", "DAILY_MAX_SHIFTS"];
    const hardConflictsA = conflictsA.filter((c) => !allowedTypes.includes(c.type));
    const hardConflictsB = conflictsB.filter((c) => !allowedTypes.includes(c.type));

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

    const requiresApproval = [...conflictsA, ...conflictsB].some(
      (c) => c.type === "DAILY_MAX_HOURS" || c.type === "DAILY_MAX_SHIFTS"
    );

    const shouldOptimisticUpdate = !requiresApproval;

    if (shouldOptimisticUpdate && onOptimisticUpdate) {
      onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, targetSlot.employeeId ?? null);
      onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, sourceSlot.employeeId);
    }

    setConflicts([]);
    setMessage(null);
    setIsMoving(true);
    try {
      triggerFlash([slotKey(sourceSlot), slotKey(targetSlot)], "success");

      const result = await moveAssignment(sourceSlot, targetSlot, false);

      if (result.ok === false && result.data?.status === 409 && result.data.requiresConfirmation) {
        setPendingRequest({
          title: "Gửi yêu cầu xác nhận xếp ca",
          description: typeof result.data.error === "string" ? result.data.error : "Vượt giới hạn xếp ca",
          conflicts: result.data.conflicts ?? [],
          onConfirm: async () => {
            setPendingRequest(null);
            
            setIsMoving(true);
            try {
              const confirmResult = await moveAssignment(sourceSlot, targetSlot, true);
              if (!confirmResult.ok) {
                setConflicts(confirmResult.data?.conflicts ?? []);
                notify({
                  title: "Không thể đổi ca",
                  body: confirmResult.data?.error || "Đã có lỗi xảy ra",
                  tone: "error",
                  dedupeKey: `error-${Date.now()}`,
                });
                triggerFlash([slotKey(sourceSlot), slotKey(targetSlot)], "error");
                return;
              }

              if (confirmResult.data?.pendingApproval) {
                if (shouldOptimisticUpdate && onOptimisticUpdate) {
                  onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, sourceSlot.employeeId);
                  onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, targetSlot.employeeId);
                }
                notify({
                  title: "Chờ xác nhận",
                  body: confirmResult.data.message || "Đã gửi yêu cầu xác nhận",
                  tone: "warning",
                });
              } else {
                if (!shouldOptimisticUpdate && onOptimisticUpdate) {
                  onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, targetSlot.employeeId ?? null);
                  onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, sourceSlot.employeeId);
                }
                const sourceEmployee = employees.find((e) => e.id === sourceSlot.employeeId);
                const targetShift = shifts.find((sh) => sh.id === targetSlot.shiftTemplateId);
                const formattedTargetDate = format(parseDateOnly(targetSlot.date), "dd/MM/yyyy");
                notify({
                  title: "Cập nhật thành công",
                  body: `Đã đổi ${sourceEmployee?.name} sang ${targetShift?.name || "ca"} ngày ${formattedTargetDate}`,
                  tone: "success",
                  dedupeKey: `success-${Date.now()}-${Math.random()}`,
                });
              }
              await onRefresh();
            } catch (err) {
              triggerFlash([slotKey(sourceSlot), slotKey(targetSlot)], "error");
            } finally {
              setIsMoving(false);
            }
          },
          onCancel: () => {
            setPendingRequest(null);
            setConflicts(result.data?.conflicts ?? []);
          },
        });
        return;
      }

      if (!result.ok) {
        if (shouldOptimisticUpdate && onOptimisticUpdate) {
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
        if (shouldOptimisticUpdate && onOptimisticUpdate) {
          onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, sourceSlot.employeeId);
          onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, targetSlot.employeeId);
        }
        notify({
          title: "Chờ xác nhận",
          body: result.data.message || "Đã gửi yêu cầu xác nhận",
          tone: "warning",
        });
      } else {
        if (!shouldOptimisticUpdate && onOptimisticUpdate) {
          onOptimisticUpdate(sourceSlot.storeId, sourceSlot.shiftTemplateId, sourceSlot.date, sourceSlot.slotIndex, targetSlot.employeeId ?? null);
          onOptimisticUpdate(targetSlot.storeId, targetSlot.shiftTemplateId, targetSlot.date, targetSlot.slotIndex, sourceSlot.employeeId);
        }
        const sourceEmployee = employees.find((e) => e.id === sourceSlot.employeeId);
        const targetShift = shifts.find((sh) => sh.id === targetSlot.shiftTemplateId);
        const formattedTargetDate = format(parseDateOnly(targetSlot.date), "dd/MM/yyyy");
        notify({
          title: "Cập nhật thành công",
          body: `Đã đổi ${sourceEmployee?.name} sang ${targetShift?.name || "ca"} ngày ${formattedTargetDate}`,
          tone: "success",
          dedupeKey: `success-${Date.now()}-${Math.random()}`,
        });
      }

      await onRefresh();
    } catch (err) {
      if (shouldOptimisticUpdate && onOptimisticUpdate) {
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
    syncFromMain();
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
      syncFromMain();
    };

    const handlePointerUp = () => {
      scrollbarDragStateRef.current = null;
      syncFromMain();
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [plannerContentWidth, plannerViewportWidth, syncFromMain]);

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

  if (hasEmployeeFilter && visibleGroupKeys.size === 0) {
    const employeeNames = targetEmployeeIds
      .map((id) => employeeMap.get(id)?.name)
      .filter(Boolean)
      .join(", ");

    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          <p className="font-medium">
            {employeeNames ? `Nhân viên (${employeeNames})` : "Nhân viên đã chọn"} chưa có ca nào trong khoảng đang xem.
          </p>
          <p className="mt-1 text-sm">Đổi tuần/tháng hoặc bỏ bộ lọc nhân viên để xem toàn bộ lịch.</p>
        </CardContent>
      </Card>
    );
  }

  if (visibleStores.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          <p className="font-medium">Không có cửa hàng nào phù hợp với bộ lọc đã chọn.</p>
          <p className="mt-1 text-sm">Vui lòng chọn lại cửa hàng hoặc chọn &quot;Tất cả cửa hàng&quot;.</p>
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
        <p className="text-sm text-slate-600 dark:text-[#CCCCCC]">
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
              onScroll={syncFromMain}
              onMouseDown={handlePlannerMouseDown}
              className={cn(
                "hover-scrollbars max-h-[calc(100vh-16rem)] overflow-auto",
                isSpacePressed && "cursor-grab",
                isPanning && "cursor-grabbing select-none"
              )}
            >
              {(() => {
                const currentInViewDate =
                  activeScrollDate && visibleDates.includes(activeScrollDate)
                    ? activeScrollDate
                    : visibleDates[0];

                return (
                  <table
                    ref={plannerTableRef}
                    className="w-max min-w-full border-separate border-spacing-0 text-sm"
                  >
                    <thead>
                      <tr>
                        <th className="sticky top-0 left-0 z-30 min-w-[180px] border-r border-b border-slate-200 bg-slate-100 px-4 py-2 text-left font-bold text-slate-900 dark:border-[#333333] dark:bg-[#252526] dark:text-white">
                          <div className="flex items-center justify-between gap-1.5">
                            <span>Ca làm</span>
                            {currentInViewDate && (
                              <span
                                title={`Đang hiển thị theo ca của ngày ${format(parseISO(currentInViewDate), "dd/MM/yyyy")}`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50 transition-all duration-150 shrink-0"
                              >
                                {format(parseISO(currentInViewDate), "dd/MM")}
                              </span>
                            )}
                          </div>
                        </th>
                        {visibleDates.map((date) => {
                          const note = dayNoteMap.get(date);
                          const color = getDayNoteColor(note?.colorKey);
                          return (
                            <th
                              key={date}
                              data-date={date}
                              onClick={() => setActiveScrollDate(date)}
                              className={cn(
                                "sticky top-0 z-20 min-w-[240px] border-r border-b border-slate-200 bg-slate-50 px-3 py-2 align-top text-center transition-colors dark:border-[#333333] dark:bg-[#1E1E1E]",
                                note && !color.isNone && color.softClass
                              )}
                              style={note && !color.isNone ? color.softStyle : undefined}
                            >
                          <div className="space-y-1">
                            <div className="min-h-[16px] text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-[#9D9D9D]">
                              {note?.note ?? ""}
                            </div>
                            <div className="font-bold capitalize text-slate-900 dark:text-white">
                              {format(parseISO(date), "EEEE", { locale: vi })}
                            </div>
                            <div className="text-sm font-semibold text-slate-700 dark:text-[#CCCCCC]">
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

                    // Nhóm các ca có cùng tên và khung giờ (từ các bảng cấu hình ca khác nhau trong kỳ)
                    type ShiftRowGroup = {
                      key: string;
                      name: string;
                      startTime: string;
                      endTime: string;
                      sortOrder: number;
                      shifts: typeof storeShifts;
                    };

                    const groupMap = new Map<string, ShiftRowGroup>();
                    for (const shift of storeShifts) {
                      const groupKey = `${shift.name}|${shift.startTime}|${shift.endTime}`;
                      const existing = groupMap.get(groupKey);
                      if (existing) {
                        existing.shifts.push(shift);
                        existing.sortOrder = Math.min(existing.sortOrder, shift.sortOrder);
                      } else {
                        groupMap.set(groupKey, {
                          key: groupKey,
                          name: shift.name,
                          startTime: shift.startTime,
                          endTime: shift.endTime,
                          sortOrder: shift.sortOrder,
                          shifts: [shift],
                        });
                      }
                    }
                    const shiftRowGroups = Array.from(groupMap.values()).sort(
                      (a, b) => a.sortOrder - b.sortOrder
                    );

                    // Trên mỗi ngày của visibleDates, tìm các nhóm ca thực sự có ca/slot trên ngày đó
                    const activeGroupsByDate = new Map<string, ShiftRowGroup[]>();
                    for (const date of visibleDates) {
                      const activeForDate = shiftRowGroups
                        .filter((group) =>
                          group.shifts.some(
                            (s) => (slotsByGroup.get(`${date}|${store.id}|${s.id}`) ?? []).length > 0
                          )
                        )
                        .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder);
                      activeGroupsByDate.set(date, activeForDate);
                    }

                    // Số hàng tối đa trong 1 ngày cho cửa hàng này (Dynamic Shift Stacking)
                    const maxDailyShifts = Math.max(
                      0,
                      ...visibleDates.map((date) => activeGroupsByDate.get(date)?.length ?? 0)
                    );
                    const hasAnySlotsForStore = maxDailyShifts > 0;

                    return (
                      <Fragment key={store.id}>
                        <tr key={`${store.id}-header`}>
                          <td className="sticky top-[78px] left-0 z-20 border-r border-b border-slate-200 bg-slate-100 px-4 py-2 font-bold text-slate-900 dark:border-[#333333] dark:bg-[#252526] dark:text-white">
                            <div className="flex items-center gap-3">
                              <StoreLogo
                                store={store}
                                className="h-5 w-5 bg-white dark:bg-[#1E1E1E] dark:border-[#3C3C3C]"
                                fallbackClassName="text-[8px]"
                              />
                              <span>{store.name}</span>
                            </div>
                          </td>
                          {visibleDates.map((date) => {
                            const note = dayNoteMap.get(date);
                            const color = getDayNoteColor(note?.colorKey);
                            return (
                              <td
                                key={`${store.id}-${date}-header`}
                                className={cn(
                                  "sticky top-[78px] z-10 border-r border-b border-slate-200 px-3 py-2 dark:border-[#333333]",
                                  note && !color.isNone ? color.softClass : "bg-white dark:bg-[#1E1E1E]"
                                )}
                                style={note && !color.isNone ? color.softStyle : undefined}
                              >
                                <div className="flex min-h-6 items-center justify-center">
                                  <StoreLogo
                                    store={store}
                                    className="h-5 w-5 border-slate-200 bg-white shadow-sm dark:border-[#3C3C3C] dark:bg-[#252526]"
                                    fallbackClassName="text-[7px] text-slate-300"
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                        {storeShifts.length === 0 || !hasAnySlotsForStore ? (
                          <tr key={`${store.id}-empty`}>
                            <td
                              colSpan={visibleDates.length + 1}
                              className="border-b border-slate-200 bg-amber-50/70 p-4 dark:border-[#333333] dark:bg-amber-950/20"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>Cửa hàng <strong>{store.name}</strong> chưa có cấu hình ca làm việc cho khoảng thời gian này.</span>
                                </div>
                                {companyId && (
                                  <Link
                                    href={`/app/${companyId}/cau-hinh-ca`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors shadow-xs"
                                  >
                                    <span>Chuyển sang tab Cấu hình ca để thêm ca làm</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          Array.from({ length: maxDailyShifts }).map((_, r) => {
                            const shiftOnActiveDate = activeGroupsByDate.get(currentInViewDate)?.[r];
                            const shiftsAtRow = visibleDates
                              .map((date) => activeGroupsByDate.get(date)?.[r])
                              .filter(Boolean) as ShiftRowGroup[];
                            const uniqueKeys = Array.from(
                              new Set(shiftsAtRow.map((g) => `${g.name}|${g.startTime}|${g.endTime}`))
                            );
                            const isUniform = uniqueKeys.length === 1;
                            const primaryGroup = shiftsAtRow[0];

                            // Tự động biến đổi theo ca của ngày đang xem (currentInViewDate)
                            const rowTitle = shiftOnActiveDate
                              ? shiftOnActiveDate.name
                              : isUniform
                              ? primaryGroup?.name || `Ca thứ ${r + 1}`
                              : `Ca thứ ${r + 1}`;

                            const rowSubtitle = shiftOnActiveDate
                              ? `${shiftOnActiveDate.startTime}-${shiftOnActiveDate.endTime}`
                              : isUniform
                              ? `${primaryGroup?.startTime}-${primaryGroup?.endTime}`
                              : `(Nghỉ ca ngày ${format(parseISO(currentInViewDate), "dd/MM")})`;

                            return (
                              <tr key={`${store.id}-row-${r}`}>
                                <td className="sticky left-0 z-10 border-r border-b border-slate-200 bg-white px-4 py-2 align-top dark:border-[#333333] dark:bg-[#252526] transition-colors duration-150">
                                  <div className="font-bold text-slate-900 dark:text-white truncate transition-all duration-150" title={rowTitle}>
                                    {rowTitle}
                                  </div>
                                  <div
                                    className={cn(
                                      "text-xs font-semibold font-mono truncate transition-all duration-150",
                                      shiftOnActiveDate
                                        ? "text-slate-600 dark:text-[#CCCCCC]"
                                        : "text-slate-400 dark:text-neutral-500 italic"
                                    )}
                                  >
                                    {rowSubtitle}
                                  </div>
                                </td>
                                {visibleDates.map((date) => {
                                  const groupForDate = activeGroupsByDate.get(date)?.[r];
                                  const note = dayNoteMap.get(date);
                                  const color = getDayNoteColor(note?.colorKey);

                                  if (!groupForDate) {
                                    return (
                                      <td
                                        key={`${store.id}-r${r}-${date}`}
                                        className={cn(
                                          "min-w-[240px] border-r border-b border-slate-200 align-top dark:border-[#333333]",
                                          note && !color.isNone ? color.softClass : "bg-white dark:bg-[#1E1E1E]"
                                        )}
                                        style={note && !color.isNone ? color.softStyle : undefined}
                                      >
                                        <div className="space-y-1.5 p-1.5">
                                          <div className="flex min-h-[48px] items-center justify-center rounded-lg border border-dashed border-slate-200/80 bg-slate-50/40 px-2 py-2 text-center text-xs text-slate-400 dark:border-neutral-800/60 dark:bg-neutral-900/20 dark:text-neutral-600">
                                            —
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  }

                                  const daySlots = groupForDate.shifts.flatMap(
                                    (s) => slotsByGroup.get(`${date}|${store.id}|${s.id}`) ?? []
                                  );
                                  const hasSelectedEmployeeInGroup =
                                    !hasEmployeeFilter ||
                                    groupForDate.shifts.some((s) => visibleGroupKeys.has(`${date}|${store.id}|${s.id}`));
                                  const shiftForDate =
                                    groupForDate.shifts.find(
                                      (s) => (slotsByGroup.get(`${date}|${store.id}|${s.id}`) ?? []).length > 0
                                    ) || groupForDate.shifts[0];

                                  return (
                                    <td
                                      key={`${store.id}-r${r}-${date}`}
                                      className={cn(
                                        "min-w-[240px] border-r border-b border-slate-200 align-top dark:border-[#333333]",
                                        note && !color.isNone ? color.softClass : "bg-white dark:bg-[#1E1E1E]"
                                      )}
                                      style={note && !color.isNone ? color.softStyle : undefined}
                                    >
                                      <div className="space-y-1.5 p-1.5">
                                        {daySlots.length > 0 && hasSelectedEmployeeInGroup ? (
                                          <CompactSlotGroup
                                            slots={daySlots}
                                            shift={shiftForDate}
                                            store={store}
                                            employeeMap={employeeMap}
                                            employees={eligibleEmployeesByStore.get(store.id) ?? []}
                                            canEdit={canEdit && (canEditPast || date >= todayStr)}
                                            loading={loading}
                                            flashSlots={flashSlots}
                                            overtimes={overtimes.filter(
                                              (ot) =>
                                                ot.storeId === store.id &&
                                                groupForDate.shifts.some((s) => s.id === ot.shiftTemplateId) &&
                                                ot.date === date
                                            )}
                                            onAddOvertime={() => {
                                              setOvertimeSlotContext({
                                                storeId: store.id,
                                                shiftTemplateId: shiftForDate.id,
                                                date,
                                              });
                                              setOvertimeModalMode("add");
                                              setOvertimeModalOpen(true);
                                            }}
                                            onEditOvertime={(id, empId, hours) => {
                                              setEditingOvertimeId(id);
                                              setEditingOvertimeEmployeeId(empId);
                                              setEditingOvertimeInitialHours(hours);
                                              setOvertimeModalMode("edit");
                                              setOvertimeModalOpen(true);
                                            }}
                                            onDeleteOvertime={deleteOvertime}
                                            onAssign={(slot, id) => assignEmployee(slot, id)}
                                            onClear={(slot) => assignEmployee(slot, null)}
                                            onAddFault={(slot) => setFaultSlot(slot)}
                                          />
                                        ) : hasEmployeeFilter ? (
                                          <div className="min-h-[112px]" />
                                        ) : (
                                          <div className="flex min-h-[48px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/70 px-2 py-2 text-center text-xs text-slate-400 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-500">
                                            —
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
                );
              })()}
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
            {visibleDates.map((date) => {
              const note = dayNoteMap.get(date);
              const color = getDayNoteColor(note?.colorKey);
              return (
                <Card
                  key={date}
                  className={cn(
                    note && !color.isNone && color.softClass
                  )}
                  style={note && !color.isNone ? color.softStyle : undefined}
                >
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 capitalize">
                      <span>{format(parseISO(date), "EEEE, dd/MM/yyyy", { locale: vi })}</span>
                      {note && (
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium normal-case",
                            color.chipClass
                          )}
                          style={!color.isNone ? color.chipStyle : undefined}
                        >
                          {note.note}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
                    {visibleStores.map((store) => (
                      <div key={store.id} className="space-y-3 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <StoreLogo
                            store={store}
                            className="h-6 w-6 bg-white shrink-0"
                            fallbackClassName="text-[9px]"
                          />
                          <h4 className="font-bold text-slate-800 dark:text-neutral-100 truncate text-sm sm:text-base">{store.name}</h4>
                        </div>
                        {(() => {
                          const activeStoreShifts = (shiftsByStore.get(store.id) ?? [])
                            .filter((shift) => visibleShiftIdsByStore.get(store.id)?.has(shift.id))
                            .filter((shift) => (slotsByGroup.get(`${date}|${store.id}|${shift.id}`) ?? []).length > 0);

                          if (activeStoreShifts.length === 0) {
                            return (
                              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-4 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
                                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                                  Chưa có cấu hình ca cho ngày này.
                                </p>
                                {companyId && (
                                  <Link
                                    href={`/app/${companyId}/cau-hinh-ca`}
                                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline dark:text-amber-400"
                                  >
                                    <span>Chuyển sang tab Cấu hình ca để thêm ca làm</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="grid gap-2 sm:gap-2.5 grid-cols-2 2xl:grid-cols-3">
                              {activeStoreShifts.map((shift) => {
                                const daySlots = slotsByGroup.get(`${date}|${store.id}|${shift.id}`) ?? [];
                                if (
                                  daySlots.length === 0 ||
                                  (hasEmployeeFilter &&
                                    !visibleGroupKeys.has(`${date}|${store.id}|${shift.id}`))
                                ) {
                                  return null;
                                }

                                return (
                                  <CompactSlotGroup
                                    key={`${date}|${store.id}|${shift.id}`}
                                    slots={daySlots}
                                    shift={shift}
                                    store={store}
                                    employeeMap={employeeMap}
                                    employees={eligibleEmployeesByStore.get(store.id) ?? []}
                                    canEdit={canEdit && (canEditPast || date >= todayStr)}
                                    loading={loading}
                                    flashSlots={flashSlots}
                                    overtimes={overtimes.filter((ot) => ot.storeId === store.id && ot.shiftTemplateId === shift.id && ot.date === date)}
                                    onAddOvertime={() => {
                                      setOvertimeSlotContext({ storeId: store.id, shiftTemplateId: shift.id, date });
                                      setOvertimeModalMode("add");
                                      setOvertimeModalOpen(true);
                                    }}
                                    onEditOvertime={(id, empId, hours) => {
                                      setEditingOvertimeId(id);
                                      setEditingOvertimeEmployeeId(empId);
                                      setEditingOvertimeInitialHours(hours);
                                      setOvertimeModalMode("edit");
                                      setOvertimeModalOpen(true);
                                    }}
                                    onDeleteOvertime={deleteOvertime}
                                    onAssign={(slot, id) => assignEmployee(slot, id)}
                                    onClear={(slot) => assignEmployee(slot, null)}
                                    onAddFault={(slot) => setFaultSlot(slot)}
                                  />
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activeEmployee ? (
            layoutMode === "horizontal" ? (
              <div className="flex min-w-[120px] items-center justify-between gap-2 rounded-md bg-blue-100 px-1 py-0.5 opacity-90 shadow-lg ring-1 ring-blue-400">
                <p className="text-xs font-semibold text-slate-900">{activeEmployee.name}</p>
              </div>
            ) : (
              <div className="min-w-[180px] rounded-lg border border-blue-400 bg-blue-50 p-2 text-xs opacity-90 shadow-lg ring-2 ring-blue-400">
                <p className="font-medium text-slate-800">{activeEmployee.name}</p>
              </div>
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Full-screen Modal for Scheduler sending request */}
      {pendingRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
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
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {loading ? "Đang xử lý..." : isAdmin ? "Xác nhận" : "Gửi yêu cầu duyệt"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {faultSlot && faultSlot.employeeId && (
        <FaultModal
          isOpen={!!faultSlot}
          onClose={() => setFaultSlot(null)}
          employeeName={employees.find((e) => e.id === faultSlot?.employeeId)?.name || ""}
          shiftName={shifts.find((s) => s.id === faultSlot?.shiftTemplateId)?.name || ""}
          faults={faultSlot ? slots.find(s => slotKey(s) === slotKey(faultSlot))?.faults : undefined}
          onAddFault={handleSaveFault}
          onEditFault={handleEditFault}
          onDeleteFault={handleDeleteFault}
          readOnly={!canEdit}
        />
      )}

      {overtimeModalOpen && (
        <OvertimeModal
          isOpen={overtimeModalOpen}
          onClose={() => {
            setOvertimeModalOpen(false);
            setEditingOvertimeId(null);
            setEditingOvertimeEmployeeId(undefined);
            setEditingOvertimeInitialHours(undefined);
          }}
          onSubmit={submitOvertime}
          employees={employees}
          existingEmployeeIds={
            overtimeSlotContext
              ? new Set(
                  overtimes
                    .filter(
                      (ot) =>
                        ot.storeId === overtimeSlotContext.storeId &&
                        ot.shiftTemplateId === overtimeSlotContext.shiftTemplateId &&
                        ot.date === overtimeSlotContext.date
                    )
                    .map((ot) => ot.employeeId)
                )
              : new Set()
          }
          loading={loading}
          mode={overtimeModalMode}
          initialEmployeeId={editingOvertimeEmployeeId}
          initialHours={editingOvertimeInitialHours}
        />
      )}

      {confirmingDeleteOvertimeId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg">Xác nhận xoá</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600">
                Bạn có chắc chắn muốn xoá giờ làm thêm này?
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setConfirmingDeleteOvertimeId(null)} disabled={loading}>
                  Huỷ bỏ
                </Button>
                <Button variant="destructive" onClick={confirmDeleteOvertime} disabled={loading}>
                  Xác nhận xoá
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
