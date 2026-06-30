"use client";

import { useEffect, useState } from "react";
import { format, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar";
import { ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { formatDateOnly } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/client";

type SchedulePageClientProps = {
  user: {
    name: string;
    role: UserRole;
  };
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

export function SchedulePageClient({ user }: SchedulePageClientProps) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [layoutMode, setLayoutMode] = useState<"horizontal" | "vertical">("horizontal");
  const [referenceDate, setReferenceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [storeId, setStoreId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user.role === "ADMIN" || user.role === "SCHEDULER";

  async function loadSchedule() {
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode, date: referenceDate });
      if (storeId) params.set("storeId", storeId);
      const res = await fetch(`/api/schedule?${params}`);
      const json = ensureObject<Record<string, unknown>>(
        await readJsonSafely<Record<string, unknown>>(res, {}),
        {}
      );
      if (!res.ok) {
        setError((json.error as string) ?? "Không tải được lịch");
        return;
      }
      setData(json);
    } catch {
      setError("Không kết nối được server");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, referenceDate, storeId]);

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
      await loadSchedule();
    } catch {
      setError("Không kết nối được server. Kiểm tra npm run dev đang chạy.");
    } finally {
      setGenerating(false);
    }
  }

  function navigate(direction: -1 | 1) {
    const current = new Date(referenceDate);
    const next =
      mode === "week"
        ? direction === 1
          ? addWeeks(current, 1)
          : subWeeks(current, 1)
        : direction === 1
          ? addMonths(current, 1)
          : subMonths(current, 1);
    setReferenceDate(format(next, "yyyy-MM-dd"));
  }

  const employees = ensureArray<{
    id: string;
    name: string;
    position: string;
    storeIds?: string[];
  }>(data?.employees);

  useEffect(() => {
    if (employees.length === 0) {
      setSelectedEmployeeId("");
      return;
    }

    if (user.role === "EMPLOYEE") {
      setSelectedEmployeeId(employees[0]?.id ?? "");
      return;
    }

    setSelectedEmployeeId((current) =>
      current && employees.some((employee) => employee.id === current) ? current : ""
    );
  }, [employees, user.role]);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        {canEdit ? (
          <Button onClick={autoGenerate} disabled={generating || refreshing}>
            <Wand2 className="mr-2 h-4 w-4" />
            {generating ? "Đang xếp..." : "Xếp ca tự động"}
          </Button>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tài khoản Nhân viên chỉ xem lịch — dùng Admin hoặc Người xếp ca để chỉnh
          </p>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {message && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value as "week" | "month")}
            className="max-w-[140px]"
          >
            <option value="week">Theo tuần</option>
            <option value="month">Theo tháng</option>
          </Select>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[200px] text-center text-sm font-medium">
              {data.start as string} → {data.end as string}
            </span>
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
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={layoutMode === "horizontal" ? "default" : "outline"}
              onClick={() => setLayoutMode("horizontal")}
            >
              Bảng ngang
            </Button>
            <Button
              type="button"
              size="sm"
              variant={layoutMode === "vertical" ? "default" : "outline"}
              onClick={() => setLayoutMode("vertical")}
            >
              Bảng dọc
            </Button>
          </div>

          <div className="ml-auto text-sm text-slate-600">
            {stats.filledSlots}/{stats.totalSlots} ca đã xếp
            {stats.unfilledCount > 0 && (
              <span className="ml-2 text-amber-600">· {stats.unfilledCount} ca trống</span>
            )}
          </div>
        </CardContent>
      </Card>

      {refreshing && <p className="text-center text-sm text-slate-500">Đang cập nhật lịch...</p>}

      <ScheduleCalendar
        stores={stores}
        shifts={shifts}
        slots={slots}
        employees={employees}
        dayNotes={dayNotes}
        unfilled={unfilled}
        selectedEmployeeId={selectedEmployeeId}
        layoutMode={layoutMode}
        canEdit={canEdit && !generating}
        onRefresh={loadSchedule}
      />
    </div>
  );
}
