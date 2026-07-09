"use client";

import { useEffect, useState, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar";
import { ChevronLeft, ChevronRight, Wand2, AlertTriangle, Trash2 } from "lucide-react";
import { formatDateOnly, parseDateOnly } from "@/lib/utils";
import { useNotifications } from "@/components/notifications/notification-center";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import type { UserRole } from "@/generated/prisma/client";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthPicker } from "@/components/ui/month-picker";

type SchedulePageClientProps = {
  user: {
    name: string;
    role: UserRole;
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
  const [storeId, setStoreId] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("schedule_storeId") || "";
    return "";
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("schedule_selectedEmployeeId") || "";
    return "";
  });
  const scheduleParams = new URLSearchParams({ mode, date: referenceDate });
  if (storeId) scheduleParams.set("storeId", storeId);
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

  const shouldLoadApprovals = user.role === "ADMIN" || user.role === "SCHEDULER";
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

  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();
  
  const statusHashRef = useRef<{ assignments: string | null; requests: string | null }>({ assignments: null, requests: null });

  const canEdit = user.role === "ADMIN" || user.role === "SCHEDULER";

  useEffect(() => {
    if (scheduleErrorObj) setError(scheduleErrorObj.message);
  }, [scheduleErrorObj]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("schedule_mode", mode);
      sessionStorage.setItem("schedule_layoutMode", layoutMode);
      sessionStorage.setItem("schedule_referenceDate", referenceDate);
      sessionStorage.setItem("schedule_storeId", storeId);
      sessionStorage.setItem("schedule_selectedEmployeeId", selectedEmployeeId);
    }
  }, [mode, layoutMode, referenceDate, storeId, selectedEmployeeId]);

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
    storeId,
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
          storeIds: storeId ? [storeId] : undefined,
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

  const employees = ensureArray<{
    id: string;
    name: string;
    position: string;
    storeIds?: string[];
    maxShiftsPerMonth?: number;
    maxHoursPerMonth?: number;
    isActive?: boolean;
    deletedAt?: string | null;
  }>(data?.employees);

  useEffect(() => {
    if (employees.length === 0) {
      setSelectedEmployeeId("");
      return;
    }
    setSelectedEmployeeId((current) =>
      current && employees.some((employee) => employee.id === current) ? current : ""
    );
  }, [employees]);

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

  const stores = ensureArray<{ id: string; name: string; logoUrl?: string }>(data.stores);
  const shifts = ensureArray<{
    id: string;
    storeId: string;
    name: string;
    startTime: string;
    endTime: string;
    sortOrder: number;
    durationHours: number;
  }>(data.shifts);
  const slots = ensureArray<{
    storeId: string;
    shiftTemplateId: string;
    date: Date | string;
    slotIndex: number;
    requiredStaff: number;
    employeeId: string | null;
    assignmentId?: string;
  }>(data.slots).map((slot) => ({
    ...slot,
    date:
      typeof slot.date === "string"
        ? slot.date.split("T")[0]
        : formatDateOnly(new Date(slot.date)),
  }));
  const dayNotes = ensureArray<{
    date: string;
    note: string;
    colorKey: string;
  }>(data.dayNotes);
  const unfilled = ensureArray<{ storeName: string; shiftName: string; date: string }>(data.unfilled);
  const stats = ensureObject<{ totalSlots: number; filledSlots: number; unfilledCount: number }>(
    data.stats,
    { totalSlots: 0, filledSlots: 0, unfilledCount: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl font-bold">Lịch xếp ca</h1>
          <p className="text-slate-600">
            Xếp ca tự động · Chọn nhân viên thủ công · Kéo thả đổi ca
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Đang đăng nhập: {user.name} (
            {user.role === "ADMIN"
              ? "Quản trị"
              : user.role === "SCHEDULER"
                ? "Người xếp ca"
                : "Nhân viên"}
            )
          </p>
        </div>
        {!canEdit ? (
          <p className="mt-3 inline-flex rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tài khoản Nhân viên chỉ xem lịch — dùng Admin hoặc Người xếp ca để chỉnh
          </p>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <Select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value as "day" | "week" | "month")}
            className="max-w-[140px]"
          >
            <option value="day">Theo ngày</option>
            <option value="week">Theo tuần</option>
            <option value="month">Theo tháng</option>
          </Select>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-[210px] flex-col items-center gap-1">
              {mode === "month" ? (
                <MonthPicker
                  value={referenceDate.slice(0, 7)}
                  onChange={handleMonthChange}
                  ariaLabel="Chọn tháng xem lịch"
                  className="h-10 min-w-[180px]"
                />
              ) : (
                <DatePicker
                  value={referenceDate}
                  onChange={setReferenceDate}
                  ariaLabel="Chọn ngày xem lịch"
                  className="h-10 min-w-[150px] justify-center text-center"
                />
              )}
              <span className="text-xs font-medium text-slate-500">
                {data.start as string} → {data.end as string}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="max-w-[200px]"
          >
            <option value="">Tất cả cửa hàng</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>

          <Select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="min-w-[220px] max-w-[260px]"
          >
            <option value="">Tất cả nhân viên</option>
            {employees.filter(e => e.isActive !== false && !e.deletedAt).map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>

          {canEdit ? (
            <div className="flex gap-2">
              <Button onClick={autoGenerate} disabled={generating || refreshing}>
                <Wand2 className="mr-2 h-4 w-4" />
                {generating ? "Đang xếp..." : "Xếp ca tự động"}
              </Button>
              <Button variant="destructive" onClick={clearSchedule} disabled={isClearing || refreshing}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isClearing ? "Đang xoá..." : "Xoá ca"}
              </Button>
            </div>
          ) : null}

          <div className="ml-auto text-sm text-slate-600">
            {stats.filledSlots}/{stats.totalSlots} ca đã xếp
            {stats.unfilledCount > 0 && (
              <span className="ml-2 text-amber-600">· {stats.unfilledCount} ca trống</span>
            )}
          </div>
        </CardContent>
      </Card>

      {canEdit && approvalRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {user.role === "ADMIN" ? "Yêu cầu chờ duyệt (" : "Yêu cầu của bạn đang chờ duyệt ("}
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
                    {user.role === "ADMIN" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setConfirmingApproval(request)}
                          disabled={refreshing}
                        >
                          Duyệt
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => decideApproval(request.id, "REJECT")}
                          disabled={refreshing}
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
                        disabled={refreshing}
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {refreshing ? "Đang xử lý..." : "Xác nhận duyệt"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}


      <ScheduleCalendar
        stores={stores}
        shifts={shifts}
        slots={slots}
        employees={employees}
        dayNotes={dayNotes}
        unfilled={unfilled}
        overtimes={data.overtimes || []}
        selectedEmployeeId={selectedEmployeeId}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        canEdit={canEdit && !generating}
        isAdmin={user.role === "ADMIN"}
        onRefresh={refreshScheduleAndApprovals}
        onOptimisticUpdate={handleOptimisticUpdate}
        onOptimisticOvertimeUpdate={handleOptimisticOvertimeUpdate}
      />
    </div>
  );
}
