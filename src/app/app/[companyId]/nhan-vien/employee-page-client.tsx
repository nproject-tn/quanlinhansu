"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { ChevronDown, ChevronUp, Plus, TimerReset, Ban } from "lucide-react";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/utils";
import { useNotifications } from "@/components/notifications/notification-center";
import {
  calcMaxHoursFromShifts,
  calcMaxShiftsFromHours,
  DEFAULT_SHIFT_HOURS,
} from "@/lib/shift-utils";
import { EmployeeFaultsModal } from "@/components/employees/employee-faults-modal";
import { format } from "date-fns";
import type { UserRole } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";

type Store = { id: string; name: string };
type Employee = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  employmentType: string;
  position: string;
  salaryType: string;
  monthlySalary?: number;
  hourlyRate?: number;
  maxShiftsPerMonth: number;
  maxHoursPerMonth: number;
  isActive: boolean;
  deletedAt?: string | null;
  stores: { store: Store }[];
};

type EmployeeMonthlyHours = {
  id: string;
  name: string;
  position: string;
  maxShiftsPerMonth: number;
  maxHoursPerMonth: number;
  month: string;
  actualHours: number;
  overtimeHours: number;
  totalHours: number;
  actualShifts: number;
  hoursDelta: number;
  shiftsDelta: number;
  totalFaults: number;
  faults: any[];
  deletedAt?: string | null;
  isArchived?: boolean;
  isActive?: boolean;
};

type SessionPayload = {
  user?: {
    role: UserRole;
  };
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  employmentType: string;
  position: string;
  salaryType: string;
  monthlySalary: string;
  hourlyRate: string;
  maxShiftsPerMonth: string;
  maxHoursPerMonth: string;
  storeIds: string[];
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  email: "",
  employmentType: "FULL_TIME",
  position: "",
  salaryType: "HOURLY",
  monthlySalary: "",
  hourlyRate: "",
  maxShiftsPerMonth: "22",
  maxHoursPerMonth: "160",
  storeIds: [],
  isActive: true,
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

export function EmployeePageClient({ userRole, userPermissions, companyId }: { userRole: UserRole; userPermissions?: any; companyId: string }) {
  const [filterType, setFilterType] = useState<"ACTIVE" | "RESIGNED" | "ALL">("ACTIVE");

  const fetcher = async () => {
    const [empRes, storeRes, shiftRes] = await Promise.all([
      fetch(`/api/employees?companyId=${companyId}`),
      fetch(`/api/stores?companyId=${companyId}&lean=1`),
      fetch(`/api/shift-templates?companyId=${companyId}`),
    ]);
    const empData = await readJsonSafely<Employee[]>(empRes, []);
    const stores = await readJsonSafely<Store[]>(storeRes, []);
    const shifts = await readJsonSafely<Array<{ durationHours: number }>>(shiftRes, []);
    
    let avgShiftHours = DEFAULT_SHIFT_HOURS;
    if (shifts.length > 0) {
      const avg = shifts.reduce((s: number, t: { durationHours: number }) => s + t.durationHours, 0) / shifts.length;
      avgShiftHours = Math.round(avg * 10) / 10 || DEFAULT_SHIFT_HOURS;
    }
    return { employees: empData, stores, avgShiftHours };
  };

  const { data: pageData, mutate: load } = useSWR(`employees_page_data_${companyId}`, fetcher);
  const allEmployees = pageData?.employees ?? [];
  const employeesFiltered = useMemo(() => {
    switch (filterType) {
      case "ACTIVE": return allEmployees.filter(e => !e.deletedAt);
      case "RESIGNED": return allEmployees.filter(e => e.deletedAt != null);
      case "ALL": return allEmployees;
      default: return allEmployees;
    }
  }, [allEmployees, filterType]);
  
  const employees = employeesFiltered;
  const stores = pageData?.stores ?? [];
  const avgShiftHours = pageData?.avgShiftHours ?? DEFAULT_SHIFT_HOURS;

  const [monthlyHours, setMonthlyHours] = useState<EmployeeMonthlyHours[]>([]);
  const filteredMonthlyHours = useMemo(() => {
    switch (filterType) {
      case "ACTIVE":
        return monthlyHours.filter((mh) => !mh.deletedAt && !mh.isArchived && mh.isActive !== false);
      case "RESIGNED":
        return monthlyHours.filter((mh) => mh.deletedAt != null || mh.isArchived || mh.isActive === false);
      case "ALL":
      default:
        return monthlyHours;
    }
  }, [monthlyHours, filterType]);
  const [selectedFaultsEmployee, setSelectedFaultsEmployee] = useState<EmployeeMonthlyHours | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(userRole);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [lastEdited, setLastEdited] = useState<"shifts" | "hours" | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hoursMonth, setHoursMonth] = useState(() => {
    return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  });

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const month = sessionStorage.getItem("employee_hoursMonth");
    if (month) setHoursMonth(month);
    setIsInitialized(true);
  }, []);
  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();
  const canManageEmployees = currentRole === "OWNER" || hasPermission(currentRole ?? "", userPermissions, "employees", "EDIT");
  const canDeleteEmployees = currentRole === "OWNER" || hasPermission(currentRole ?? "", userPermissions, "employees", "DELETE");
  const canViewHours = currentRole === "OWNER" || hasPermission(currentRole ?? "", userPermissions, "employees", "VIEW_HOURS");
  async function loadMonthlyHours(month: string) {
    const res = await fetch(`/api/employees/monthly-hours?month=${month}`);
    const data = await readJsonSafely<EmployeeMonthlyHours[]>(res, []);
    setMonthlyHours(data);
  }


  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      sessionStorage.setItem("employee_hoursMonth", hoursMonth);
    }
  }, [hoursMonth, isInitialized]);



  useEffect(() => {
    if (canManageEmployees) return;
    setShowForm(false);
    setEditingId(null);
  }, [canManageEmployees]);

  useEffect(() => {
    if (!isInitialized) return;
    void loadMonthlyHours(hoursMonth);
  }, [hoursMonth, isInitialized]);

  useEffect(() => {
    if (!message) return;

    notify({
      title: "Thông báo nhân viên",
      body: message,
      tone: message.toLowerCase().includes("không") || message.toLowerCase().includes("lỗi") ? "error" : "success",
      dedupeKey: `employees|${message}`,
    });
    setMessage(null);
  }, [message, notify]);

  function updateShifts(value: string) {
    setLastEdited("shifts");
    setForm((f) => {
      const next = { ...f, maxShiftsPerMonth: value };
      if (value !== "" && !isNaN(Number(value))) {
        next.maxHoursPerMonth = String(
          calcMaxHoursFromShifts(Number(value), avgShiftHours)
        );
      }
      return next;
    });
  }

  function updateHours(value: string) {
    setLastEdited("hours");
    setForm((f) => {
      const next = { ...f, maxHoursPerMonth: value };
      if (value !== "" && !isNaN(Number(value))) {
        next.maxShiftsPerMonth = String(
          calcMaxShiftsFromHours(Number(value), avgShiftHours)
        );
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageEmployees) {
      setMessage("Bạn chỉ có quyền xem danh sách nhân viên");
      return;
    }

    const shifts = Number(form.maxShiftsPerMonth);
    const hours = Number(form.maxHoursPerMonth);
    if (!shifts || shifts < 1 || !hours || hours < 1) {
      setMessage("Vui lòng nhập số ca/tháng và số giờ/tháng hợp lệ");
      return;
    }

    const payload = {
      ...form,
      maxShiftsPerMonth: shifts,
      maxHoursPerMonth: hours,
      monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
    };

    const res = await fetch(editingId ? `/api/employees/${editingId}` : "/api/employees", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafely<{ error?: { fieldErrors?: unknown } }>(res, {});
    if (res.ok) {
      setMessage(editingId ? "Đã cập nhật nhân viên" : "Đã thêm nhân viên");
      setForm(emptyForm);
      setEditingId(null);
      setLastEdited(null);
      setShowForm(false);
      void load();
      void loadMonthlyHours(hoursMonth);
    } else {
      setMessage(data.error?.fieldErrors ? "Dữ liệu không hợp lệ" : "Lỗi lưu nhân viên");
    }
  }

  async function handleDelete(id: string, name: string, isPermanent: boolean = false) {
    if (!canManageEmployees) {
      setMessage("Bạn không có quyền xoá nhân viên");
      return;
    }

    const approved = await confirm({
      title: isPermanent ? `Xóa vĩnh viễn "${name}"?` : `Xóa nhân viên "${name}"?`,
      description: isPermanent ? "Hành động này không thể hoàn tác. Toàn bộ dữ liệu của nhân viên sẽ bị xoá." : "Lịch sử các ca làm trước đó sẽ được giữ lại. Các ca làm từ hôm nay trở về sau sẽ bị làm trống.",
      confirmLabel: isPermanent ? "Xóa vĩnh viễn" : "Xóa nhân viên",
      cancelLabel: "Huỷ",
      tone: "destructive",
    });
    if (!approved) return;
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    const data = await readJsonSafely<{ message?: string }>(res, {});
    setMessage(data.message ?? "Đã xóa");
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }
    void load();
    void loadMonthlyHours(hoursMonth);
  }

  async function handleRestore(id: string, name: string) {
    if (!canManageEmployees) return;
    
    const approved = await confirm({
      title: `Khôi phục nhân viên "${name}"?`,
      description: "Nhân viên sẽ được hiển thị lại trong danh sách đang làm việc.",
      confirmLabel: "Khôi phục",
      cancelLabel: "Huỷ",
    });
    if (!approved) return;

    const res = await fetch(`/api/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true })
    });
    if (res.ok) {
      setMessage("Đã khôi phục nhân viên");
      void load();
      void loadMonthlyHours(hoursMonth);
    } else {
      setMessage("Lỗi khôi phục nhân viên");
    }
  }

  function startEdit(emp: Employee) {
    if (!canManageEmployees) return;

    setEditingId(emp.id);
    setLastEdited(null);
    setForm({
      name: emp.name,
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      employmentType: emp.employmentType,
      position: emp.position,
      salaryType: emp.salaryType,
      monthlySalary: emp.monthlySalary?.toString() ?? "",
      hourlyRate: emp.hourlyRate?.toString() ?? "",
      maxShiftsPerMonth: String(emp.maxShiftsPerMonth),
      maxHoursPerMonth: String(emp.maxHoursPerMonth),
      storeIds: emp.stores.map((s) => s.store.id),
      isActive: emp.isActive,
    });
  }

  function toggleStore(storeId: string) {
    if (!canManageEmployees) return;

    setForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(storeId)
        ? f.storeIds.filter((id) => id !== storeId)
        : [...f.storeIds, storeId],
    }));
  }

  function renderEmployeeForm(submitLabel: string) {
    return (
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Họ tên *</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Chức vụ *</label>
          <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Loại nhân viên</label>
          <Select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Loại lương</label>
          <Select value={form.salaryType} onChange={(e) => setForm({ ...form, salaryType: e.target.value })}>
            <option value="HOURLY">Theo giờ</option>
            <option value="FIXED_MONTHLY">Cố định tháng</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Số ca tối đa/tháng
            <span className="ml-1 text-xs text-slate-400">(~{avgShiftHours}h/ca)</span>
          </label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="22"
            value={form.maxShiftsPerMonth}
            onChange={(e) => updateShifts(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Số giờ tối đa/tháng</label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="160"
            value={form.maxHoursPerMonth}
            onChange={(e) => updateHours(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <p className="md:col-span-2 text-xs text-slate-500">
          * Tự động tính: đổi ca → cập nhật giờ và ngược lại (dựa trên {avgShiftHours}h/ca trung bình).
          {lastEdited && ` Vừa chỉnh: ${lastEdited === "shifts" ? "số ca" : "số giờ"}.`}
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium">SĐT</label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium">Cửa hàng phụ trách *</label>
          <div className="flex flex-wrap gap-2">
            {stores.map((store) => (
              <button
                key={store.id}
                type="button"
                onClick={() => toggleStore(store.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${form.storeIds.includes(store.id) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300"}`}
              >
                {store.name}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit">{submitLabel}</Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setLastEdited(null);
              }}
            >
              Hủy
            </Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {canManageEmployees && showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Thêm nhân viên mới</CardTitle>
          </CardHeader>
          <CardContent>
            {renderEmployeeForm("Thêm nhân viên")}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Danh sách nhân viên ({employees.length})</CardTitle>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "ACTIVE" | "RESIGNED" | "ALL")}
              className="w-48 glass-control bg-white/60"
            >
              <option value="ALL">Tất cả nhân viên</option>
              <option value="ACTIVE">Nhân viên đang làm</option>
              <option value="RESIGNED">Nhân viên đã nghỉ</option>
            </Select>

            {canManageEmployees && (
              <Button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setLastEdited(null);
                  setShowForm((current) => !current);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {showForm ? "Ẩn form" : "Thêm nhân viên"}
                {showForm ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-4">Tên</th>
                  <th className="pb-2 pr-4">Chức vụ</th>
                  <th className="pb-2 pr-4">Loại</th>
                  <th className="pb-2 pr-4">Ca/tháng</th>
                  <th className="pb-2 pr-4">Giờ/tháng</th>
                  <th className="pb-2 pr-4">Cửa hàng</th>
                  {canManageEmployees && <th className="pb-2">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <Fragment key={emp.id}>
                    <tr className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium">{emp.name}</td>
                      <td className="py-3 pr-4">{emp.position}</td>
                      <td className="py-3 pr-4">
                        <Badge>{EMPLOYMENT_TYPE_LABELS[emp.employmentType]}</Badge>
                      </td>
                      <td className="py-3 pr-4">{emp.maxShiftsPerMonth}</td>
                      <td className="py-3 pr-4">{emp.maxHoursPerMonth}h</td>
                      <td className="py-3 pr-4">{emp.stores.map((s) => s.store.name).join(", ")}</td>
                      {(canManageEmployees || canDeleteEmployees) && (
                        <td className="py-3 px-4 flex gap-2">
                          {!emp.deletedAt ? (
                            <>
                              {canManageEmployees && (
                                <Button variant="outline" size="sm" onClick={() => startEdit(emp)} className="text-slate-600 border-slate-200 hover:bg-slate-100">Sửa</Button>
                              )}
                              {canDeleteEmployees && (
                                <Button variant="outline" size="sm" onClick={() => handleDelete(emp.id, emp.name, false)} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">Xóa</Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleRestore(emp.id, emp.name)}>Khôi phục</Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(emp.id, emp.name, true)}>Xóa vĩnh viễn</Button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                    {canManageEmployees && editingId === emp.id && (
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <td className="px-4 py-4" colSpan={7}>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                              <h3 className="text-base font-semibold text-slate-900">
                                Sửa nhân viên: {emp.name}
                              </h3>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingId(null);
                                  setForm(emptyForm);
                                  setLastEdited(null);
                                }}
                              >
                                Đóng
                              </Button>
                            </div>
                            {renderEmployeeForm("Cập nhật")}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {canViewHours && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TimerReset className="h-5 w-5" />
            Giờ làm thực tế trong tháng
          </CardTitle>
          <MonthPicker
            value={hoursMonth}
            onChange={setHoursMonth}
            className="min-w-[190px]"
            ariaLabel="Chọn tháng xem giờ làm thực tế"
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-4">Tên</th>
                  <th className="pb-2 pr-4">Chức vụ</th>
                  <th className="pb-2 pr-4">Giờ làm chính</th>
                  <th className="pb-2 pr-4">Giờ làm thêm</th>
                  <th className="pb-2 pr-4">Tổng giờ thực tế</th>
                  <th className="pb-2 pr-4">Ca thực tế</th>
                  <th className="pb-2 pr-4">Giờ tối đa</th>
                  <th className="pb-2 pr-4">Chênh lệch giờ</th>
                  <th className="pb-2 pr-4">Chênh lệch ca</th>
                  <th className="pb-2">Số lỗi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyHours.map((emp) => (
                  <tr key={`${emp.id}-${emp.month}`} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{emp.name}</span>
                        {(emp.deletedAt || emp.isArchived || emp.isActive === false) && (
                          <span className="relative group/tooltip inline-flex items-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-red-50 p-0.5 border border-red-200 shadow-sm cursor-pointer">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3.5 w-3.5 text-red-600 shrink-0"
                              >
                                <circle cx="12" cy="12" r="9.5" />
                                <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
                              </svg>
                            </span>
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs font-normal text-white shadow-lg z-50">
                              Đã nghỉ việc
                              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">{emp.position}</td>
                    <td className="py-3 pr-4">{emp.actualHours}h</td>
                    <td className="py-3 pr-4">{emp.overtimeHours}h</td>
                    <td className="py-3 pr-4 font-medium text-blue-600">{emp.totalHours}h</td>
                    <td className="py-3 pr-4">{emp.actualShifts}</td>
                    <td className="py-3 pr-4">{emp.maxHoursPerMonth}h</td>
                    <td className="py-3 pr-4">
                      <span className={emp.hoursDelta > 0 ? "font-medium text-red-600" : emp.hoursDelta < 0 ? "text-amber-600" : "text-emerald-600"}>
                        {emp.hoursDelta > 0 ? "+" : ""}{emp.hoursDelta}h
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={emp.shiftsDelta > 0 ? "font-medium text-red-600" : emp.shiftsDelta < 0 ? "text-amber-600" : "text-emerald-600"}>
                        {emp.shiftsDelta > 0 ? "+" : ""}{emp.shiftsDelta}
                      </span>
                    </td>
                    <td className="py-3">
                      {emp.totalFaults > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedFaultsEmployee(emp)}
                          className="font-medium text-red-600 hover:text-red-700 underline underline-offset-2"
                        >
                          {emp.totalFaults}
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {selectedFaultsEmployee && (
        <EmployeeFaultsModal
          isOpen={!!selectedFaultsEmployee}
          onClose={() => setSelectedFaultsEmployee(null)}
          employeeName={selectedFaultsEmployee.name}
          month={selectedFaultsEmployee.month}
          faults={selectedFaultsEmployee.faults}
        />
      )}
    </div>
  );
}
