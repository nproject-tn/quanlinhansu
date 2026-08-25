"use client";

import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wand2,
  AlertTriangle,
  Trash2,
  Settings2,
  FileSpreadsheet,
  ImageIcon,
  Loader2,
  Download,
} from "lucide-react";
import { formatDateOnly, formatDateVN, formatWeekRangeLabel, parseDateOnly } from "@/lib/utils";
import { useNotifications } from "@/components/notifications/notification-center";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import type { UserRole } from "@/generated/prisma/client";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthPicker } from "@/components/ui/month-picker";
import { hasPermission } from "@/lib/permissions";
import { StoreScheduleRuleModal } from "@/components/schedule/store-schedule-rule-modal";
import { exportScheduleToExcel } from "@/lib/schedule-excel-exporter";
import { exportScheduleToImage } from "@/lib/schedule-image-exporter";
import { MultiSelect } from "@/components/ui/multi-select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

type SchedulePageClientProps = {
  user: {
    name: string;
    role: UserRole;
    permissions?: any;
  };
};

type ApprovalRequest = {
  id: string;
  actionType: "ASSIGN_EMPLOYEE" | "MOVE_ASSIGNMENT" | "DELETE_FAULT";
  message: string;
  conflicts?: Array<{ message?: string; employeeId?: string; date?: string; storeId?: string; shiftTemplateId?: string }>;
  requestedBy?: {
    name?: string;
    email?: string;
  } | null;
  createdAt?: string;
  payload?: any;
};

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

function ensureObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : fallback;
}

function addUtcDays(dateStr: string, days: number) {
  const date = parseDateOnly(dateStr);
  return formatDateOnly(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
  );
}

function addUtcMonths(dateStr: string, months: number) {
  const date = parseDateOnly(dateStr);
  return formatDateOnly(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)));
}

function normalizeToMonthStart(dateStr: string) {
  const date = parseDateOnly(dateStr);
  return formatDateOnly(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

export function SchedulePageClient({ user }: SchedulePageClientProps) {
  const [mode, setMode] = useState<"day" | "week" | "month">(() => {
    if (typeof window !== "undefined") return (sessionStorage.getItem("schedule_mode") as "day" | "week" | "month") || "week";
    return "week";
  });
  const [layoutMode, setLayoutMode] = useState<"horizontal" | "vertical">(() => {
    if (typeof window !== "undefined") return (sessionStorage.getItem("schedule_layoutMode") as "horizontal" | "vertical") || "horizontal";
    return "horizontal";
  });
  const [referenceDate, setReferenceDate] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("schedule_referenceDate") || format(new Date(), "yyyy-MM-dd");
    return format(new Date(), "yyyy-MM-dd");
  });
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("schedule_selectedStoreIds");
        if (stored) return JSON.parse(stored);
        const single = sessionStorage.getItem("schedule_storeId");
        if (single) return [single];
      } catch {}
    }
    return [];
  });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("schedule_selectedEmployeeIds");
        if (stored) return JSON.parse(stored);
        const single = sessionStorage.getItem("schedule_selectedEmployeeId");
        if (single) return [single];
      } catch {}
    }
    return [];
  });
  const scheduleParams = new URLSearchParams({ mode, date: referenceDate });
  const scheduleUrl = `/api/schedule?${scheduleParams.toString()}`;

  const { data, mutate: mutateSchedule, isValidating: refreshingSchedule, error: scheduleErrorObj } = useSWR<Record<string, any>>(scheduleUrl, async (url: string) => {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      let errorMsg = "Không tải được lịch";
      try {
        const json = JSON.parse(text);
        if (json.error) errorMsg = json.error;
      } catch {}
      throw new Error(errorMsg);
    }
    return JSON.parse(text);
  }, { revalidateOnFocus: false, refreshInterval: 10000 });

  const shouldLoadApprovals = hasPermission(user.role, user.permissions, "schedule", "APPROVE") || hasPermission(user.role, user.permissions, "schedule", "EDIT");
  const { data: approvalRequests = [], mutate: mutateApprovalRequests, isValidating: refreshingApprovals } = useSWR<ApprovalRequest[]>(
    shouldLoadApprovals ? "/api/schedule/approval-requests" : null,
    async (url: string) => {
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) return [];
      if (!text.trim()) return [];
      return JSON.parse(text);
    },
    { revalidateOnFocus: false, refreshInterval: 10000 }
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const refreshing = refreshingSchedule || refreshingApprovals || isProcessing;

  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingApproval, setConfirmingApproval] = useState<ApprovalRequest | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // Export states
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  useEffect(() => {
    const handleRefresh = () => mutateSchedule();
    window.addEventListener("refresh-schedule-stores", handleRefresh);
    return () => window.removeEventListener("refresh-schedule-stores", handleRefresh);
  }, [mutateSchedule]);

  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();
  
  const statusHashRef = useRef<{ assignments: string | null; requests: string | null }>({ assignments: null, requests: null });

  const canEdit = hasPermission(user.role, user.permissions, "schedule", "EDIT");

  useEffect(() => {
    if (scheduleErrorObj) setError(scheduleErrorObj.message);
  }, [scheduleErrorObj]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("schedule_mode", mode);
      sessionStorage.setItem("schedule_layoutMode", layoutMode);
      sessionStorage.setItem("schedule_referenceDate", referenceDate);
      sessionStorage.setItem("schedule_selectedStoreIds", JSON.stringify(selectedStoreIds));
      sessionStorage.setItem("schedule_selectedEmployeeIds", JSON.stringify(selectedEmployeeIds));
    }
  }, [mode, layoutMode, referenceDate, selectedStoreIds, selectedEmployeeIds]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden || refreshing || generating || confirmingApproval) {
        return;
      }
      try {
        const res = await fetch("/api/schedule/status");
        if (!res.ok) return;
        const status = await res.json();

        let shouldReloadSchedule = false;
        let shouldReloadRequests = false;

        if (status.assignments !== statusHashRef.current.assignments) {
          shouldReloadSchedule = true;
          statusHashRef.current.assignments = status.assignments;
        }

        if (status.requests !== statusHashRef.current.requests) {
          shouldReloadRequests = true;
          statusHashRef.current.requests = status.requests;
        }

        if (shouldReloadSchedule) void mutateSchedule();
        if (shouldReloadRequests) void mutateApprovalRequests();
      } catch (err) {}
    }, 10000);

    return () => clearInterval(interval);
  }, [
    mode,
    referenceDate,
    selectedStoreIds,
    user.role,
    refreshing,
    generating,
    confirmingApproval,
  ]);

  async function refreshScheduleAndApprovals() {
    await mutateSchedule();
    await mutateApprovalRequests();
  }

  function handleOptimisticUpdate(storeId: string, shiftTemplateId: string, date: string, slotIndex: number, employeeId: string | null) {
    if (!data || !Array.isArray(data.slots)) return;
    mutateSchedule((prevData: any) => {
      if (!prevData || !Array.isArray(prevData.slots)) return prevData;
      return {
        ...prevData,
        slots: prevData.slots.map((slot: any) => {
          const slotDateStr = typeof slot.date === "string" ? slot.date.split("T")[0] : formatDateOnly(new Date(slot.date));
          if (
            slot.storeId === storeId &&
            slot.shiftTemplateId === shiftTemplateId &&
            slotDateStr === date &&
            slot.slotIndex === slotIndex
          ) {
            return { ...slot, employeeId };
          }
          return slot;
        }),
      };
    }, false);
  }

  function handleOptimisticOvertimeUpdate(
    action: "add" | "edit" | "delete",
    payload: { id?: string; storeId?: string; shiftTemplateId?: string; date?: string; employeeId?: string; hours?: number }
  ) {
    if (!data || !Array.isArray(data.overtimes)) return;
    mutateSchedule((prevData: any) => {
      if (!prevData || !Array.isArray(prevData.overtimes)) return prevData;
      let newOvertimes = [...prevData.overtimes];
      
      if (action === "add") {
        newOvertimes.push({
          id: payload.id || `temp-${Date.now()}`,
          storeId: payload.storeId!,
          shiftTemplateId: payload.shiftTemplateId!,
          date: payload.date!,
          employeeId: payload.employeeId!,
          hours: payload.hours!,
        });
      } else if (action === "edit") {
        const idx = newOvertimes.findIndex((o: any) => o.id === payload.id);
        if (idx !== -1) {
          newOvertimes[idx] = { ...newOvertimes[idx], hours: payload.hours! };
        }
      } else if (action === "delete") {
        newOvertimes = newOvertimes.filter((o: any) => o.id !== payload.id);
      }
      
      return {
        ...prevData,
        overtimes: newOvertimes,
      };
    }, false);
  }

  // Handle Export Excel
  async function handleExportExcel() {
    if (!data || !Array.isArray(data.slots)) {
      notify({ tone: "error", title: "Lỗi", body: "Chưa có dữ liệu lịch để xuất file Excel" });
      return;
    }

    setIsExportingExcel(true);
    try {
      const selectedStoresList =
        selectedStoreIds.length > 0 ? stores.filter((s) => selectedStoreIds.includes(s.id)) : stores;
      const storeFilterName =
        selectedStoreIds.length === 0
          ? "Tất cả cửa hàng"
          : selectedStoresList.map((s) => s.name).join(", ");

      const selectedEmpsList =
        selectedEmployeeIds.length > 0 ? employees.filter((e) => selectedEmployeeIds.includes(e.id)) : employees;
      const employeeFilterName =
        selectedEmployeeIds.length === 0
          ? "Tất cả nhân viên"
          : selectedEmpsList.map((e) => e.name).join(", ");

      const scheduleDates = [...new Set((data.slots as any[]).map((s) => s.date))].sort();

      await exportScheduleToExcel({
        companyName: typeof window !== "undefined" ? document.title.split("-")[0]?.trim() || "ApexFlow" : "ApexFlow",
        mode,
        referenceDate,
        startDateStr: data.start as string,
        endDateStr: data.end as string,
        dates: scheduleDates,
        stores: selectedStoresList,
        shifts: (data.shifts as any[]) || [],
        slots: (data.slots as any[]) || [],
        employees,
        overtimes: (data.overtimes as any[]) || [],
        dayNotes: (data.dayNotes as any[]) || [],
        storeFilterName,
        employeeFilterName,
        selectedStoreIds,
        selectedEmployeeIds,
      });

      notify({
        tone: "success",
        title: "Xuất Excel thành công",
        body: "Đã tải xuống file Excel lịch làm việc đa sheet với đầy đủ màu sắc!",
      });
    } catch (err: any) {
      console.error("Export Excel error:", err);
      notify({ tone: "error", title: "Lỗi xuất Excel", body: err.message || "Không thể xuất file Excel" });
    } finally {
      setIsExportingExcel(false);
    }
  }

  // Handle Export Image (Full Horizontal High-DPI Schedule)
  async function handleExportImage() {
    if (!data || !Array.isArray(data.slots)) {
      notify({ tone: "error", title: "Lỗi", body: "Chưa có dữ liệu lịch để xuất ảnh" });
      return;
    }

    setIsExportingImage(true);
    try {
      const selectedStoresList =
        selectedStoreIds.length > 0 ? stores.filter((s) => selectedStoreIds.includes(s.id)) : stores;
      const storeFilterName =
        selectedStoreIds.length === 0
          ? "Tất cả cửa hàng"
          : selectedStoresList.map((s) => s.name).join(", ");

      const selectedEmpsList =
        selectedEmployeeIds.length > 0 ? employees.filter((e) => selectedEmployeeIds.includes(e.id)) : employees;
      const employeeFilterName =
        selectedEmployeeIds.length === 0
          ? "Tất cả nhân viên"
          : selectedEmpsList.map((e) => e.name).join(", ");

      const scheduleDates = [...new Set((data.slots as any[]).map((s) => s.date))].sort();

      await exportScheduleToImage({
        companyName: typeof window !== "undefined" ? document.title.split("-")[0]?.trim() || "ApexFlow" : "ApexFlow",
        mode,
        referenceDate,
        startDateStr: data.start as string,
        endDateStr: data.end as string,
        dates: scheduleDates,
        stores: selectedStoresList,
        shifts: (data.shifts as any[]) || [],
        slots: (data.slots as any[]) || [],
        employees,
        overtimes: (data.overtimes as any[]) || [],
        dayNotes: (data.dayNotes as any[]) || [],
        storeFilterName,
        employeeFilterName,
        selectedStoreIds,
        selectedEmployeeIds,
      });

      notify({
        tone: "success",
        title: "Xuất ảnh thành công",
        body: "Đã tải xuống hình ảnh bảng ngang lịch xếp ca sắc nét (Full HD)!",
      });
    } catch (err: any) {
      console.error("Export Image error:", err);
      notify({ tone: "error", title: "Lỗi xuất ảnh", body: err.message || "Không thể tạo file ảnh" });
    } finally {
      setIsExportingImage(false);
    }
  }

  async function decideApproval(requestId: string, action: "APPROVE" | "REJECT") {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedule/approval-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = ensureObject<{ message?: string; error?: string }>(
        await readJsonSafely<{ message?: string; error?: string }>(res, {}),
        {}
      );

      if (!res.ok) {
        setError(json.error ?? "Không xử lý được yêu cầu duyệt");
        return;
      }

      setMessage(json.message ?? (action === "APPROVE" ? "Đã duyệt yêu cầu" : "Đã từ chối yêu cầu"));
      setConfirmingApproval(null);
      await refreshScheduleAndApprovals();
    } catch {
      setError("Không kết nối được server");
    } finally {
      setIsProcessing(false);
    }
  }

  async function cancelRequest(requestId: string) {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedule/approval-requests/${requestId}`, {
        method: "DELETE",
      });
      const json = ensureObject<{ message?: string; error?: string }>(
        await readJsonSafely<{ message?: string; error?: string }>(res, {}),
        {}
      );

      if (!res.ok) {
        setError(json.error ?? "Không huỷ được yêu cầu");
        return;
      }

      setMessage(json.message ?? "Đã huỷ yêu cầu");
      await refreshScheduleAndApprovals();
    } catch {
      setError("Không kết nối được server");
    } finally {
      setIsProcessing(false);
    }
  }

  async function autoGenerate() {
    setGenerating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          referenceDate,
          storeIds: selectedStoreIds.length > 0 ? selectedStoreIds : undefined,
          preserveManual: true,
        }),
      });
      const json = ensureObject<{ message?: string; error?: string }>(
        await readJsonSafely<{ message?: string; error?: string }>(res, {}),
        {}
      );
      if (!res.ok) {
        setError(json.error ?? `Xếp ca thất bại (${res.status})`);
        return;
      }
      setMessage(json.message ?? "Đã xếp ca thành công");
      await refreshScheduleAndApprovals();
    } catch {
      setError("Không kết nối được server. Kiểm tra npm run dev đang chạy.");
    } finally {
      setGenerating(false);
    }
  }

  async function clearSchedule() {
    const isConfirmed = await confirm({
      title: "Xác nhận xoá ca",
      description: `Bạn có chắc chắn muốn xoá toàn bộ ca làm việc ${mode === "day" ? "trong ngày này" : mode === "week" ? "trong tuần này" : "trong tháng này"}? Hành động này không thể hoàn tác.`,
      confirmLabel: "Xoá ca",
      cancelLabel: "Huỷ",
      tone: "destructive",
    });
    if (!isConfirmed) return;

    setIsClearing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(scheduleUrl, {
        method: "DELETE",
      });
      const json = ensureObject<{ message?: string; error?: string }>(
        await readJsonSafely<{ message?: string; error?: string }>(res, {}),
        {}
      );
      if (!res.ok) {
        setError(json.error ?? `Xoá ca thất bại (${res.status})`);
        return;
      }
      setMessage(json.message ?? "Đã xoá ca thành công");
      await refreshScheduleAndApprovals();
    } catch {
      setError("Không kết nối được server.");
    } finally {
      setIsClearing(false);
    }
  }

  function navigate(direction: -1 | 1) {
    setReferenceDate(
      mode === "month" 
        ? addUtcMonths(referenceDate, direction)
        : addUtcDays(referenceDate, mode === "week" ? direction * 7 : direction)
    );
  }

  function handleModeChange(nextMode: "day" | "week" | "month") {
    setMode(nextMode);
    if (nextMode === "month") {
      setReferenceDate((current) => normalizeToMonthStart(current));
    }
  }

  function handleMonthChange(nextMonth: string) {
    setReferenceDate(`${nextMonth}-01`);
  }

  const stores = useMemo(() => {
    return ensureArray<{ id: string; name: string; logoUrl?: string }>(data?.allStores || data?.stores);
  }, [data?.allStores, data?.stores]);

  const employees = useMemo(() => {
    return ensureArray<{
      id: string;
      name: string;
      position: string;
      storeIds?: string[];
      maxShiftsPerMonth?: number;
      maxHoursPerMonth?: number;
      isActive?: boolean;
      deletedAt?: string | null;
    }>(data?.employees);
  }, [data?.employees]);

  const shifts = useMemo(() => {
    return ensureArray<{
      id: string;
      storeId: string;
      name: string;
      startTime: string;
      endTime: string;
      sortOrder: number;
      durationHours: number;
    }>(data?.shifts);
  }, [data?.shifts]);

  const slots = useMemo(() => {
    return ensureArray<{
      storeId: string;
      shiftTemplateId: string;
      date: Date | string;
      slotIndex: number;
      requiredStaff: number;
      employeeId: string | null;
      assignmentId?: string;
    }>(data?.slots).map((slot) => ({
      ...slot,
      date:
        typeof slot.date === "string"
          ? slot.date.split("T")[0]
          : formatDateOnly(new Date(slot.date)),
    }));
  }, [data?.slots]);

  const dayNotes = useMemo(() => {
    return ensureArray<{
      date: string;
      note: string;
      colorKey: string;
    }>(data?.dayNotes);
  }, [data?.dayNotes]);

  const unfilled = useMemo(() => {
    return ensureArray<{ storeName: string; shiftName: string; date: string }>(data?.unfilled);
  }, [data?.unfilled]);

  const stats = useMemo(() => {
    return ensureObject<{ totalSlots: number; filledSlots: number; unfilledCount: number }>(
      data?.stats,
      { totalSlots: 0, filledSlots: 0, unfilledCount: 0 }
    );
  }, [data?.stats]);

  useEffect(() => {
    if (!employees || employees.length === 0) return;
    setSelectedEmployeeIds((current) => {
      const valid = current.filter((empId) => employees.some((employee) => employee.id === empId));
      if (valid.length === current.length && valid.every((v, i) => v === current[i])) {
        return current;
      }
      return valid;
    });
  }, [employees]);

  useEffect(() => {
    if (!stores || stores.length === 0) return;
    setSelectedStoreIds((current) => {
      const valid = current.filter((sId) => stores.some((s) => s.id === sId));
      if (valid.length === current.length && valid.every((v, i) => v === current[i])) {
        return current;
      }
      return valid;
    });
  }, [stores]);

  useEffect(() => {
    if (!error) return;
    notify({
      title: "Thông báo lịch xếp ca",
      body: error,
      tone: "error",
      dedupeKey: `schedule-page-error|${error}`,
    });
  }, [error, notify]);

  useEffect(() => {
    if (!message) return;
    notify({
      title: "Thông báo lịch xếp ca",
      body: message,
      tone: "success",
      dedupeKey: `schedule-page-success|${message}`,
    });
    setMessage(null);
  }, [message, notify]);

  if (!data && error) {
    return <div className="py-12 text-center text-red-600">{error}</div>;
  }

  if (!data) {
    return <div className="py-12 text-center text-slate-500">Đang tải lịch...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl font-bold">Lịch xếp ca</h1>
          <p className="text-slate-600 dark:text-[#CCCCCC]">
            Xếp ca tự động · Chọn nhân viên thủ công · Kéo thả đổi ca
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#A0A0A0]">
            Đang đăng nhập: {user.name} ({canEdit ? "Có quyền chỉnh sửa" : "Chỉ xem"})
          </p>
        </div>
        {!canEdit ? (
          <p className="mt-3 inline-flex rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Tài khoản của bạn chỉ có quyền xem lịch.
          </p>
        ) : null}
      </div>

      <Card className="border-slate-200 shadow-xs bg-white dark:border-[#333333] dark:bg-[#252526]">
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* TOP SECTION: TIME NAVIGATION & MULTI-SELECT FILTERS */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#333333]">
            {/* Left: Mode & Date Navigator */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as "day" | "week" | "month")}
                className="w-[120px] sm:w-[130px] h-9 text-xs sm:text-sm shrink-0 font-medium"
              >
                <option value="day">Theo ngày</option>
                <option value="week">Theo tuần</option>
                <option value="month">Theo tháng</option>
              </Select>

              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="h-9 w-9 p-0 shrink-0" title="Kỳ trước">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex min-w-[135px] sm:min-w-[160px] flex-col items-center gap-0.5 flex-1 sm:flex-initial">
                  {mode === "month" ? (
                    <MonthPicker
                      value={referenceDate.slice(0, 7)}
                      onChange={handleMonthChange}
                      ariaLabel="Chọn tháng xem lịch"
                      className="h-9 w-full sm:min-w-[160px] text-xs sm:text-sm"
                    />
                  ) : (
                    <DatePicker
                      value={referenceDate}
                      onChange={setReferenceDate}
                      ariaLabel="Chọn ngày xem lịch"
                      mode={mode}
                      highlightRange={
                        mode === "week" && data?.start && data?.end
                          ? { start: data.start as string, end: data.end as string }
                          : undefined
                      }
                      customLabel={mode === "week" ? formatWeekRangeLabel(data.start as string, data.end as string) : undefined}
                      className="h-9 w-full sm:min-w-[145px] justify-center text-center text-xs sm:text-sm"
                    />
                  )}
                  <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                    {data.start === data.end
                      ? formatDateVN(data.start as string)
                      : `${formatDateVN(data.start as string)} → ${formatDateVN(data.end as string)}`}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(1)} className="h-9 w-9 p-0 shrink-0" title="Kỳ tiếp theo">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Right: Multi-Select Filters (Store & Employee) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto">
              <MultiSelect
                options={stores.map((store) => ({
                  value: store.id,
                  label: store.name,
                }))}
                selectedValues={selectedStoreIds}
                onChange={(vals) => {
                  setSelectedStoreIds(vals);
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem("schedule_selectedStoreIds", JSON.stringify(vals));
                  }
                }}
                allLabel="Tất cả cửa hàng"
                placeholder="Chọn cửa hàng..."
                entityName="cửa hàng"
                searchPlaceholder="Tìm cửa hàng..."
                className="w-full lg:w-[180px] xl:w-[200px]"
              />

              <MultiSelect
                options={employees
                  .filter((e) => e.isActive !== false && !e.deletedAt)
                  .map((employee) => ({
                    value: employee.id,
                    label: employee.name,
                    subLabel: employee.position || undefined,
                  }))}
                selectedValues={selectedEmployeeIds}
                onChange={(vals) => {
                  setSelectedEmployeeIds(vals);
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem("schedule_selectedEmployeeIds", JSON.stringify(vals));
                  }
                }}
                allLabel="Tất cả nhân viên"
                placeholder="Chọn nhân viên..."
                entityName="nhân viên"
                searchPlaceholder="Tìm nhân viên..."
                className="w-full lg:w-[190px] xl:w-[210px]"
              />
            </div>
          </div>

          {/* BOTTOM SECTION: OPERATIONAL ACTIONS, EXPORT & SUMMARY STATS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
            {/* Action Buttons (Settings, Auto-assign, Delete, Export) */}
            <div className="flex items-center gap-2 flex-wrap">
              {canEdit ? (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsRuleModalOpen(true)}
                    className="h-9 w-9 shrink-0 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-[#202024] dark:text-neutral-200 dark:hover:bg-[#28282C] dark:border-neutral-700"
                    title="Cài đặt quy tắc xếp ca"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={autoGenerate}
                    disabled={generating || isProcessing}
                    className="h-9 px-3.5 text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs shrink-0 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    {generating ? "Đang xếp..." : "Xếp ca tự động"}
                  </Button>
                  <Button
                    onClick={clearSchedule}
                    disabled={isClearing || isProcessing}
                    className="h-9 px-3 text-xs sm:text-sm font-semibold shrink-0 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 shadow-xs dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300 dark:hover:bg-rose-900/50 transition-colors"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {isClearing ? "Đang xoá..." : "Xoá ca"}
                  </Button>
                </>
              ) : null}

              {/* CONSOLIDATED EXPORT ACTION BUTTON & DROPDOWN MENU */}
              <Popover open={isExportMenuOpen} onOpenChange={setIsExportMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isExportingExcel || isExportingImage || !data}
                    className="h-9 px-3.5 text-xs sm:text-sm font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-800 transition-all flex items-center gap-1.5 shadow-xs shrink-0 dark:border-neutral-700 dark:bg-[#202024] dark:text-neutral-200 dark:hover:bg-[#28282C] dark:hover:text-white"
                    title="Tùy chọn xuất lịch làm việc (Excel hoặc Ảnh)"
                  >
                    {isExportingExcel || isExportingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    ) : (
                      <Download className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
                    )}
                    <span>
                      {isExportingExcel
                        ? "Đang xuất..."
                        : isExportingImage
                        ? "Đang chụp..."
                        : "Xuất lịch"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-400 ml-0.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-1.5 shadow-xl border-slate-200 bg-white rounded-xl z-50 dark:border-neutral-800 dark:bg-[#18181B] dark:text-white">
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-neutral-800 mb-1">
                    Tùy chọn xuất lịch
                  </div>
                  <button
                    type="button"
                    disabled={isExportingExcel || !data}
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportExcel();
                    }}
                    className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-emerald-50 text-left transition-colors group cursor-pointer disabled:opacity-50 dark:hover:bg-emerald-950/40"
                  >
                    <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors shrink-0 mt-0.5 dark:bg-emerald-950 dark:text-emerald-300">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-emerald-900 dark:text-neutral-200 dark:group-hover:text-emerald-300">
                        Xuất file Excel (.xlsx)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-neutral-400 leading-tight">
                        Ma trận ca, tổng hợp công & chi tiết tăng ca
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isExportingImage || !data}
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportImage();
                    }}
                    className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-indigo-50 text-left transition-colors group cursor-pointer disabled:opacity-50 mt-1 dark:hover:bg-indigo-950/40"
                  >
                    <div className="p-1.5 rounded-md bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200 transition-colors shrink-0 mt-0.5 dark:bg-indigo-950 dark:text-indigo-300">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-900 dark:text-neutral-200 dark:group-hover:text-indigo-300">
                        Xuất hình ảnh (.png)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-neutral-400 leading-tight">
                        Bảng ngang siêu nét HD 2x kèm watermark
                      </div>
                    </div>
                  </button>
                </PopoverContent>
              </Popover>
            </div>

            {/* Right: Summary Stats Badges */}
            <div className="text-xs sm:text-sm text-slate-600 font-medium sm:text-right shrink-0 flex items-center gap-1.5 flex-wrap sm:justify-end">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-neutral-800 dark:text-neutral-200">
                {stats.filledSlots}/{stats.totalSlots} ca đã xếp
              </span>
              {stats.unfilledCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-semibold border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50">
                  {stats.unfilledCount} ca trống
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit && approvalRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {(user.role === "OWNER" || hasPermission(user.role, user.permissions, "schedule", "APPROVE")) ? "Yêu cầu chờ duyệt (" : "Yêu cầu của bạn đang chờ duyệt ("}
              {approvalRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvalRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">{request.message}</p>
                    <p className="text-slate-600">
                      Người gửi: {request.requestedBy?.name ?? request.requestedBy?.email ?? "Người xếp ca"}
                      {request.createdAt && (
                        <span className="ml-2 text-slate-400">
                          ({format(new Date(request.createdAt), "HH:mm dd/MM/yyyy")})
                        </span>
                      )}
                    </p>
                    {request.conflicts?.length ? (
                      <ul className="space-y-1 text-amber-800">
                        {request.conflicts.slice(0, 3).map((conflict, index) => (
                          <li key={`${request.id}-${index}`}>• {conflict.message ?? "Vượt giới hạn xếp ca"}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {(user.role === "OWNER" || hasPermission(user.role, user.permissions, "schedule", "APPROVE")) ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setConfirmingApproval(request)}
                          disabled={isProcessing}
                        >
                          Duyệt
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => decideApproval(request.id, "REJECT")}
                          disabled={isProcessing}
                        >
                          Từ chối
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => cancelRequest(request.id)}
                        disabled={isProcessing}
                      >
                        Huỷ yêu cầu
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Full-screen Modal for Admin Approval */}
      {confirmingApproval && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl shadow-2xl">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <CardTitle className="text-xl text-blue-700">Xác nhận duyệt yêu cầu xếp ca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <p className="text-lg font-medium text-slate-800">{confirmingApproval.message}</p>
                <p className="text-sm text-slate-500">
                  Người gửi: {confirmingApproval.requestedBy?.name ?? "Người xếp ca"}
                  {confirmingApproval.createdAt && (
                    <span className="ml-2">({format(new Date(confirmingApproval.createdAt), "HH:mm dd/MM/yyyy")})</span>
                  )}
                </p>
              </div>

              {(() => {
                const targetEmployeeId =
                  confirmingApproval.conflicts?.[0]?.employeeId ||
                  confirmingApproval.payload?.input?.employeeId ||
                  confirmingApproval.payload?.employeeId;
                const employeeName = targetEmployeeId
                  ? employees.find((e) => e.id === targetEmployeeId)?.name
                  : "Không xác định";

                let targetDate =
                  confirmingApproval.payload?.input?.date ||
                  confirmingApproval.payload?.targetDate ||
                  confirmingApproval.payload?.date ||
                  confirmingApproval.conflicts?.[0]?.date;
                if (targetDate) {
                  try {
                    targetDate = format(new Date(targetDate), "dd/MM/yyyy");
                  } catch {
                    // ignore invalid date
                  }
                }

                const targetStoreId =
                  confirmingApproval.payload?.input?.storeId ||
                  confirmingApproval.payload?.targetStoreId ||
                  confirmingApproval.payload?.storeId;
                const storeName = targetStoreId
                  ? stores.find((s) => s.id === targetStoreId)?.name
                  : undefined;

                const targetShiftId =
                  confirmingApproval.payload?.input?.shiftTemplateId ||
                  confirmingApproval.payload?.targetShiftTemplateId ||
                  confirmingApproval.payload?.shiftTemplateId;
                const shiftName = targetShiftId
                  ? shifts.find((s) => s.id === targetShiftId)?.name
                  : undefined;

                return (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <h4 className="mb-2 font-semibold text-blue-800">Thông tin ca làm</h4>
                    <div className="space-y-1 text-sm text-blue-900">
                      <p>
                        <span className="font-medium">Nhân viên:</span> {employeeName}
                      </p>
                      {shiftName && (
                        <p>
                          <span className="font-medium">Ca làm:</span> {shiftName}
                        </p>
                      )}
                      {storeName && (
                        <p>
                          <span className="font-medium">Cửa hàng:</span> {storeName}
                        </p>
                      )}
                      {targetDate && (
                        <p>
                          <span className="font-medium">Ngày:</span> {targetDate}
                        </p>
                      )}
                      {confirmingApproval.payload?.hours !== undefined && (
                        <p>
                          <span className="font-medium">Số giờ làm thêm:</span> {confirmingApproval.payload.hours} tiếng
                        </p>
                      )}
                      {confirmingApproval.actionType === "DELETE_FAULT" && confirmingApproval.payload?.input?.faultNote !== undefined && (
                        <p>
                          <span className="font-medium">Lỗi:</span> {confirmingApproval.payload.input.faultNote || "Không có ghi chú"}{confirmingApproval.payload.input.faultTime ? ` - ${format(new Date(confirmingApproval.payload.input.faultTime), "HH:mm")}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {confirmingApproval.conflicts && confirmingApproval.conflicts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h4 className="mb-2 font-semibold text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Chi tiết cảnh báo / Vượt giới hạn
                  </h4>
                  <ul className="space-y-2 text-sm text-amber-700">
                    {confirmingApproval.conflicts.map((conflict, idx) => (
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
                  onClick={() => setConfirmingApproval(null)}
                  disabled={refreshing}
                >
                  Huỷ bỏ
                </Button>
                <Button
                  onClick={() => decideApproval(confirmingApproval.id, "APPROVE")}
                  disabled={refreshing}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {refreshing ? "Đang xử lý..." : "Xác nhận duyệt"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}


      <div id="schedule-calendar-container">
        <ScheduleCalendar
          stores={stores}
          shifts={shifts}
          slots={slots}
          employees={employees}
          dayNotes={dayNotes}
          unfilled={unfilled}
          overtimes={data.overtimes || []}
          selectedEmployeeIds={selectedEmployeeIds}
          selectedStoreIds={selectedStoreIds}
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          canEdit={canEdit && !generating}
          isAdmin={user.role === "OWNER" || hasPermission(user.role, user.permissions, "schedule", "EDIT_FREE")}
          onRefresh={refreshScheduleAndApprovals}
          onOptimisticUpdate={handleOptimisticUpdate}
          onOptimisticOvertimeUpdate={handleOptimisticOvertimeUpdate}
        />
      </div>
      {isRuleModalOpen && data?.stores && (
        <StoreScheduleRuleModal
          isOpen={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
          stores={data.stores}
        />
      )}
    </div>
  );
}
