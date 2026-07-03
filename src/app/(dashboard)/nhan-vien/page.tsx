"use client";

import { Fragment, useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { ChevronDown, ChevronUp, Plus, TimerReset } from "lucide-react";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/utils";
import { useNotifications } from "@/components/notifications/notification-center";
import {
  calcMaxHoursFromShifts,
  calcMaxShiftsFromHours,
  DEFAULT_SHIFT_HOURS,
} from "@/lib/shift-utils";

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
  actualShifts: number;
  hoursDelta: number;
  shiftsDelta: number;
};

type UserRole = "ADMIN" | "SCHEDULER" | "EMPLOYEE";

type SessionPayload = {
  user?: {
    role?: UserRole;
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

export default function EmployeesPage() {
  const fetcher = async () => {
    const [empRes, storeRes, shiftRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/stores?lean=1"),
      fetch("/api/shift-templates"),
    ]);
    const empData = await readJsonSafely<Employee[]>(empRes, []);
    const stores = await readJsonSafely<Store[]>(storeRes, []);
    const shifts = await readJsonSafely<Array<{ durationHours: number }>>(shiftRes, []);
    
    let avgShiftHours = DEFAULT_SHIFT_HOURS;
    if (shifts.length > 0) {
      const avg = shifts.reduce((s: number, t: { durationHours: number }) => s + t.durationHours, 0) / shifts.length;
      avgShiftHours = Math.round(avg * 10) / 10 || DEFAULT_SHIFT_HOURS;
    }
    return { employees: empData.filter(e => e.isActive), stores, avgShiftHours };
  };

  const { data: pageData, mutate: load } = useSWR("employees_page_data", fetcher);
  const employees = pageData?.employees ?? [];
  const stores = pageData?.stores ?? [];
  const avgShiftHours = pageData?.avgShiftHours ?? DEFAULT_SHIFT_HOURS;

  const [monthlyHours, setMonthlyHours] = useState<EmployeeMonthlyHours[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
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
  const canManageEmployees = currentRole === "ADMIN";



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
    async function loadSessionRole() {
      const res = await fetch("/api/auth/session");
      const session = await readJsonSafely<SessionPayload>(res, {});
      setCurrentRole(session.user?.role ?? null);
    }

    void loadSessionRole();
  }, []);

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

  async function handleDelete(id: string, name: string) {
    if (!canManageEmployees) {
      setMessage("Bạn không có quyền xoá nhân viên");
      return;
    }

    const approved = await confirm({
      title: `Xóa nhân viên "${name}"?`,
      description: "Nhân viên đã có lịch xếp trước đó sẽ được ẩn thay vì xoá hẳn khỏi dữ liệu.",
      confirmLabel: "Xóa nhân viên",
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
      <div>
        <h1 className="text-2xl font-bold">Quản lý nhân viên</h1>
        <p className="text-slate-600">
          {canManageEmployees
            ? "Thêm, sửa, xóa nhân viên và phân bổ cửa hàng"
            : "Xem danh sách nhân viên và giờ làm thực tế"}
        </p>
      </div>
      {canManageEmployees && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setLastEdited(null);
              setShowForm((current) => !current);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? "Ẩn bảng nhân viên" : "Thêm nhân viên"}
            {showForm ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      )}

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
        <CardHeader>
          <CardTitle>Danh sách nhân viên ({employees.length})</CardTitle>
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
                      {canManageEmployees && (
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => startEdit(emp)}>Sửa</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(emp.id, emp.name)}>Xóa</Button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {canManageEmployees && editingId === emp.id && (
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <td className="px-4 py-4" colSpan={canManageEmployees ? 7 : 6}>
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
                  <th className="pb-2 pr-4">Giờ thực tế</th>
                  <th className="pb-2 pr-4">Ca thực tế</th>
                  <th className="pb-2 pr-4">Giờ tối đa</th>
                  <th className="pb-2 pr-4">Chênh lệch giờ</th>
                  <th className="pb-2">Chênh lệch ca</th>
                </tr>
              </thead>
              <tbody>
                {monthlyHours.map((emp) => (
                  <tr key={`${emp.id}-${emp.month}`} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">{emp.name}</td>
                    <td className="py-3 pr-4">{emp.position}</td>
                    <td className="py-3 pr-4">{emp.actualHours}h</td>
                    <td className="py-3 pr-4">{emp.actualShifts}</td>
                    <td className="py-3 pr-4">{emp.maxHoursPerMonth}h</td>
                    <td className="py-3 pr-4">
                      <span className={emp.hoursDelta > 0 ? "font-medium text-red-600" : emp.hoursDelta < 0 ? "text-amber-600" : "text-emerald-600"}>
                        {emp.hoursDelta > 0 ? "+" : ""}{emp.hoursDelta}h
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={emp.shiftsDelta > 0 ? "font-medium text-red-600" : emp.shiftsDelta < 0 ? "text-amber-600" : "text-emerald-600"}>
                        {emp.shiftsDelta > 0 ? "+" : ""}{emp.shiftsDelta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
