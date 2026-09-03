"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";
import { MultiSelect } from "@/components/ui/multi-select";
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
  stores: {
    maxHoursPerMonth?: number | null;
    store: Store;
  }[];
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
  storeMaxHours: Record<string, string>;
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
  storeMaxHours: {},
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
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isEmployeeTableCollapsed, setIsEmployeeTableCollapsed] = useState(false);

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
  const stores = pageData?.stores ?? [];
  const avgShiftHours = pageData?.avgShiftHours ?? DEFAULT_SHIFT_HOURS;

  const statusFilteredEmployees = useMemo(() => {
    switch (filterType) {
      case "ACTIVE":
        return allEmployees.filter((e) => !e.deletedAt);
      case "RESIGNED":
        return allEmployees.filter((e) => e.deletedAt != null);
      case "ALL":
      default:
        return allEmployees;
    }
  }, [allEmployees, filterType]);

  const baseStores = useMemo(() => {
    if (filterType === "ALL") {
      return stores;
    }

    const assignedStoreIds = new Set<string>();
    statusFilteredEmployees.forEach((emp) => {
      emp.stores.forEach((s) => assignedStoreIds.add(s.store.id));
    });

    return stores.filter((s) => assignedStoreIds.has(s.id));
  }, [stores, statusFilteredEmployees, filterType]);

  // Bidirectional Store Filter Options:
  // If specific employees are selected, only show the stores that those selected employees belong to.
  // Otherwise, show all baseStores for the current filterType.
  const availableStoreOptions = useMemo(() => {
    let candidateStores = baseStores;

    if (selectedEmployeeIds.length > 0) {
      const selectedEmps = statusFilteredEmployees.filter((e) => selectedEmployeeIds.includes(e.id));
      const storesOfSelectedEmps = new Set<string>();
      selectedEmps.forEach((emp) => {
        emp.stores.forEach((s) => storesOfSelectedEmps.add(s.store.id));
      });
      candidateStores = baseStores.filter((s) => storesOfSelectedEmps.has(s.id));
    }

    return candidateStores.map((s) => ({ value: s.id, label: s.name }));
  }, [baseStores, statusFilteredEmployees, selectedEmployeeIds]);

  // Bidirectional Employee Filter Options:
  // If specific stores are selected, only show the employees assigned to any of those selected stores.
  // Otherwise, show all statusFilteredEmployees.
  const availableEmployeeOptions = useMemo(() => {
    let candidateEmployees = statusFilteredEmployees;

    if (selectedStoreIds.length > 0) {
      candidateEmployees = statusFilteredEmployees.filter((e) =>
        e.stores.some((s) => selectedStoreIds.includes(s.store.id))
      );
    }

    return candidateEmployees.map((e) => ({
      value: e.id,
      label: e.name,
      subLabel: e.position || undefined,
      badge: e.deletedAt ? "Đã nghỉ" : undefined,
    }));
  }, [statusFilteredEmployees, selectedStoreIds]);

  const employeesFiltered = useMemo(() => {
    return statusFilteredEmployees.filter((e) => {
      // 1. Store filter
      if (selectedStoreIds.length > 0) {
        const isInSelectedStore = e.stores.some((s) => selectedStoreIds.includes(s.store.id));
        if (!isInSelectedStore) return false;
      }

      // 2. Employee filter
      if (selectedEmployeeIds.length > 0) {
        if (!selectedEmployeeIds.includes(e.id)) return false;
      }

      return true;
    });
  }, [statusFilteredEmployees, selectedStoreIds, selectedEmployeeIds]);
  
  const employees = employeesFiltered;

  const [monthlyHours, setMonthlyHours] = useState<EmployeeMonthlyHours[]>([]);
  const filteredMonthlyHours = useMemo(() => {
    return monthlyHours.filter((mh) => {
      // 1. Status filter
      if (filterType === "ACTIVE" && (mh.deletedAt || mh.isArchived || mh.isActive === false)) return false;
      if (filterType === "RESIGNED" && (!mh.deletedAt && !mh.isArchived && mh.isActive !== false)) return false;

      // 2. Employee filter (ensure client-side consistency)
      if (selectedEmployeeIds.length > 0 && !selectedEmployeeIds.includes(mh.id)) return false;

      return true;
    });
  }, [monthlyHours, filterType, selectedEmployeeIds]);

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

    const savedStores = sessionStorage.getItem("employee_selectedStoreIds");
    if (savedStores) {
      try { setSelectedStoreIds(JSON.parse(savedStores)); } catch {}
    }

    const savedEmployees = sessionStorage.getItem("employee_selectedEmployeeIds");
    if (savedEmployees) {
      try { setSelectedEmployeeIds(JSON.parse(savedEmployees)); } catch {}
    }

    const savedFilter = sessionStorage.getItem("employee_filterType");
    if (savedFilter && ["ACTIVE", "RESIGNED", "ALL"].includes(savedFilter)) {
      setFilterType(savedFilter as "ACTIVE" | "RESIGNED" | "ALL");
    }

    setIsInitialized(true);
  }, []);

  // Prune any selected store / employee IDs that are no longer present in the available options when filterType changes
  useEffect(() => {
    if (!isInitialized) return;

    const validStoreIds = new Set(availableStoreOptions.map((o) => o.value));
    setSelectedStoreIds((prev) => {
      const next = prev.filter((id) => validStoreIds.has(id));
      return next.length === prev.length ? prev : next;
    });

    const validEmpIds = new Set(availableEmployeeOptions.map((o) => o.value));
    setSelectedEmployeeIds((prev) => {
      const next = prev.filter((id) => validEmpIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [availableStoreOptions, availableEmployeeOptions, isInitialized]);

  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();
  const canManageEmployees = currentRole === "OWNER" || hasPermission(currentRole ?? "", userPermissions, "employees", "EDIT");
  const canDeleteEmployees = currentRole === "OWNER" || hasPermission(currentRole ?? "", userPermissions, "employees", "DELETE");
  const canViewHours = currentRole === "OWNER" || hasPermission(currentRole ?? "", userPermissions, "employees", "VIEW_HOURS");

  async function loadMonthlyHours(month: string, storeIds: string[] = selectedStoreIds, empIds: string[] = selectedEmployeeIds) {
    const params = new URLSearchParams();
    params.set("month", month);
    if (storeIds.length > 0) params.set("storeIds", storeIds.join(","));
    if (empIds.length > 0) params.set("employeeIds", empIds.join(","));

    const res = await fetch(`/api/employees/monthly-hours?${params.toString()}`);
    const data = await readJsonSafely<EmployeeMonthlyHours[]>(res, []);
    setMonthlyHours(data);
  }

  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      sessionStorage.setItem("employee_hoursMonth", hoursMonth);
      sessionStorage.setItem("employee_selectedStoreIds", JSON.stringify(selectedStoreIds));
      sessionStorage.setItem("employee_selectedEmployeeIds", JSON.stringify(selectedEmployeeIds));
      sessionStorage.setItem("employee_filterType", filterType);
    }
  }, [hoursMonth, selectedStoreIds, selectedEmployeeIds, filterType, isInitialized]);

  useEffect(() => {
    if (canManageEmployees) return;
    setShowForm(false);
    setEditingId(null);
  }, [canManageEmployees]);

  useEffect(() => {
    if (!isInitialized) return;
    void loadMonthlyHours(hoursMonth, selectedStoreIds, selectedEmployeeIds);
  }, [hoursMonth, selectedStoreIds, selectedEmployeeIds, isInitialized]);

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

    const storeMaxHoursPayload: Record<string, number | null> = {};
    for (const storeId of form.storeIds) {
      const val = form.storeMaxHours[storeId];
      if (val && !isNaN(Number(val)) && Number(val) > 0) {
        storeMaxHoursPayload[storeId] = Number(val);
      } else {
        storeMaxHoursPayload[storeId] = null;
      }
    }

    const payload = {
      ...form,
      maxShiftsPerMonth: shifts,
      maxHoursPerMonth: hours,
      storeMaxHours: storeMaxHoursPayload,
      monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
    };

    const res = await fetch(editingId ? `/api/employees/${editingId}` : "/api/employees", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafely<{ error?: string | { fieldErrors?: Record<string, string[]> } }>(res, {});
    if (res.ok) {
      setMessage(editingId ? "Đã cập nhật nhân viên" : "Đã thêm nhân viên");
      setForm(emptyForm);
      setEditingId(null);
      setLastEdited(null);
      setShowForm(false);
      void load();
      void loadMonthlyHours(hoursMonth);
    } else {
      let errorText = "Lỗi lưu nhân viên";
      if (typeof data.error === "string") {
        errorText = data.error;
      } else if (data.error && typeof data.error === "object" && "fieldErrors" in data.error) {
        const fieldErrors = (data.error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
        if (fieldErrors) {
          const FIELD_NAMES: Record<string, string> = {
            name: "Họ tên",
            phone: "Số điện thoại",
            email: "Email",
            position: "Chức vụ",
            maxShiftsPerMonth: "Số ca tối đa/tháng",
            maxHoursPerMonth: "Số giờ tối đa/tháng",
            maxShiftsPerWeek: "Số ca tối đa/tuần",
            storeIds: "Cửa hàng phụ trách",
            storeMaxHours: "Định mức giờ theo cửa hàng",
          };
          const entries = Object.entries(fieldErrors);
          if (entries.length > 0) {
            const [field, messages] = entries[0];
            const fieldLabel = FIELD_NAMES[field] || field;
            const msg = messages?.[0] || "Dữ liệu không hợp lệ";
            errorText = `${fieldLabel}: ${msg}`;
          } else {
            errorText = "Dữ liệu không hợp lệ";
          }
        }
      }
      setMessage(errorText);
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
    const storeHoursMap: Record<string, string> = {};
    emp.stores.forEach((s) => {
      if (s.maxHoursPerMonth !== undefined && s.maxHoursPerMonth !== null) {
        storeHoursMap[s.store.id] = String(s.maxHoursPerMonth);
      }
    });

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
      storeMaxHours: storeHoursMap,
      isActive: emp.isActive,
    });
  }

  function toggleStore(storeId: string) {
    if (!canManageEmployees) return;

    setForm((f) => {
      const isSelected = f.storeIds.includes(storeId);
      const nextStoreIds = isSelected
        ? f.storeIds.filter((id) => id !== storeId)
        : [...f.storeIds, storeId];

      const nextStoreMaxHours = { ...f.storeMaxHours };
      if (isSelected) {
        delete nextStoreMaxHours[storeId];
      }

      return {
        ...f,
        storeIds: nextStoreIds,
        storeMaxHours: nextStoreMaxHours,
      };
    });
  }

  function distributeHoursEvenly() {
    const total = Number(form.maxHoursPerMonth) || 0;
    const count = form.storeIds.length;
    if (count === 0 || total <= 0) return;
    const perStore = Math.floor(total / count);
    const remainder = total % count;
    const nextHours: Record<string, string> = { ...form.storeMaxHours };
    form.storeIds.forEach((storeId, idx) => {
      const allotted = idx === 0 ? perStore + remainder : perStore;
      nextHours[storeId] = String(allotted);
    });
    setForm((f) => ({ ...f, storeMaxHours: nextHours }));
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
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${form.storeIds.includes(store.id) ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700" : "border-slate-300 dark:border-[#3C3C3C] text-slate-700 dark:text-neutral-300"}`}
              >
                {store.name}
              </button>
            ))}
          </div>
        </div>

        {form.storeIds.length > 0 && (() => {
          const totalMonthlyHours = Number(form.maxHoursPerMonth) || 0;
          const totalAllocatedHours = form.storeIds.reduce((sum, id) => {
            const val = Number(form.storeMaxHours[id]) || 0;
            return sum + val;
          }, 0);
          const isOverAllocated = totalAllocatedHours > totalMonthlyHours;

          return (
            <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-[#333333] bg-slate-50/70 dark:bg-[#1E1E1E]/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
                    Quy định số giờ tối đa theo từng cửa hàng (Tùy chọn)
                  </span>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    Phân bổ định mức giờ/tháng cho từng cửa hàng. Để trống nếu không giới hạn riêng theo cửa hàng.
                  </p>
                </div>
                {form.storeIds.length > 1 && (
                  <button
                    type="button"
                    onClick={distributeHoursEvenly}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    ⚡ Chia đều {form.maxHoursPerMonth || 0}h
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {form.storeIds.map((storeId) => {
                  const store = stores.find((s) => s.id === storeId);
                  if (!store) return null;
                  const hoursVal = form.storeMaxHours[storeId] ?? "";

                  return (
                    <div
                      key={storeId}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#252526]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {store.name}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-neutral-400">Tối đa tại cửa hàng</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="VD: 90"
                          className="w-20 text-center h-8 text-xs font-bold"
                          value={hoursVal}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^\d]/g, "");
                            setForm((f) => ({
                              ...f,
                              storeMaxHours: {
                                ...f.storeMaxHours,
                                [storeId]: val,
                              },
                            }));
                          }}
                        />
                        <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                          giờ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalAllocatedHours > 0 && (
                <div className="flex flex-wrap items-center justify-between text-xs pt-1 px-1 gap-2 border-t border-slate-200/60 dark:border-[#333333]/60">
                  <span className="text-slate-500 dark:text-neutral-400">
                    Tổng giờ đã phân bổ:{" "}
                    <strong className={isOverAllocated ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                      {totalAllocatedHours}h
                    </strong>{" "}
                    / {totalMonthlyHours}h
                  </span>
                  {isOverAllocated ? (
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      ⚠️ Vượt quá tổng định mức ({totalAllocatedHours - totalMonthlyHours}h)
                    </span>
                  ) : totalAllocatedHours === totalMonthlyHours ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Khớp 100% tổng định mức
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-neutral-500">
                      (Còn {totalMonthlyHours - totalAllocatedHours}h chưa phân bổ)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}
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
        <CardHeader className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Danh sách nhân viên ({employees.length})</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEmployeeTableCollapsed((prev) => !prev)}
              className="h-8 gap-1.5 px-3 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-[#3A3A3A] dark:text-neutral-200 dark:hover:bg-[#2A2A2A] shadow-2xs"
              title={isEmployeeTableCollapsed ? "Mở rộng bảng danh sách nhân viên" : "Thu gọn bảng danh sách nhân viên"}
            >
              {isEmployeeTableCollapsed ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>Mở rộng bảng</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Thu gọn bảng</span>
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2.5 w-full xl:w-auto">
            <MultiSelect
              options={availableStoreOptions}
              selectedValues={selectedStoreIds}
              onChange={setSelectedStoreIds}
              allLabel="Tất cả cửa hàng"
              placeholder="Chọn cửa hàng..."
              entityName="cửa hàng"
              searchPlaceholder="Tìm cửa hàng..."
              className="w-full lg:w-[190px]"
            />

            <MultiSelect
              options={availableEmployeeOptions}
              selectedValues={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
              allLabel="Tất cả nhân viên"
              placeholder="Chọn nhân viên..."
              entityName="nhân viên"
              searchPlaceholder="Tìm nhân viên..."
              className="w-full lg:w-[200px]"
            />

            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "ACTIVE" | "RESIGNED" | "ALL")}
              className="w-full lg:w-[170px] glass-control bg-white/60"
            >
              <option value="ACTIVE">Đang làm việc</option>
              <option value="RESIGNED">Đã nghỉ việc</option>
              <option value="ALL">Tất cả trạng thái</option>
            </Select>

            {canManageEmployees && (
              <Button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setLastEdited(null);
                  setShowForm((current) => !current);
                  if (isEmployeeTableCollapsed) {
                    setIsEmployeeTableCollapsed(false);
                  }
                }}
                className="font-semibold shrink-0"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {showForm ? "Ẩn form" : "Thêm nhân viên"}
                {showForm ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>

        {isEmployeeTableCollapsed ? (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-[#2C2C2C] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-neutral-400 bg-slate-50/50 dark:bg-[#1E1E1E]/50">
            <span>
              Bảng danh sách nhân viên đang được thu gọn. Bộ lọc bên trên vẫn áp dụng cho bảng giờ làm thực tế bên dưới.
            </span>
            <button
              type="button"
              onClick={() => setIsEmployeeTableCollapsed(false)}
              className="font-semibold text-slate-900 dark:text-white underline underline-offset-2 hover:opacity-80"
            >
              Hiển thị lại bảng ({employees.length} nhân viên)
            </button>
          </div>
        ) : (
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500 dark:border-[#333333] dark:text-[#E0E0E0]">
                    <th className="pb-2 pr-4 font-semibold">Tên</th>
                    <th className="pb-2 pr-4 font-semibold">Chức vụ</th>
                    <th className="pb-2 pr-4 font-semibold">Loại</th>
                    <th className="pb-2 pr-4 font-semibold">Ca/tháng</th>
                    <th className="pb-2 pr-4 font-semibold">Giờ/tháng</th>
                    <th className="pb-2 pr-4 font-semibold">Cửa hàng</th>
                    {canManageEmployees && <th className="pb-2 font-semibold">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <Fragment key={emp.id}>
                      <tr className="border-b border-slate-100 dark:border-[#333333] dark:hover:bg-[#2D2D30]/40">
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-[#E0E0E0]">{emp.name}</td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-[#CCCCCC]">{emp.position}</td>
                        <td className="py-3 pr-4">
                          <Badge>{EMPLOYMENT_TYPE_LABELS[emp.employmentType]}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-[#CCCCCC]">{emp.maxShiftsPerMonth}</td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-[#CCCCCC]">{emp.maxHoursPerMonth}h</td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-[#CCCCCC]">
                          {emp.stores.map((s) => s.maxHoursPerMonth ? `${s.store.name} (${s.maxHoursPerMonth}h)` : s.store.name).join(", ")}
                        </td>
                        {(canManageEmployees || canDeleteEmployees) && (
                          <td className="py-3 px-4 flex gap-2">
                            {!emp.deletedAt ? (
                              <>
                                {canManageEmployees && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setIsEmployeeTableCollapsed(false);
                                      startEdit(emp);
                                    }}
                                    className="text-slate-600 border-slate-200 hover:bg-slate-100 dark:border-[#3C3C3C] dark:bg-[#252526] dark:text-[#E0E0E0] dark:hover:bg-[#2D2D30]"
                                  >
                                    Sửa
                                  </Button>
                                )}
                                {canDeleteEmployees && (
                                  <Button variant="outline" size="sm" onClick={() => handleDelete(emp.id, emp.name, false)} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:bg-[#252526] dark:text-red-400">Xóa</Button>
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
        )}
      </Card>

      {canViewHours && (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <TimerReset className="h-5 w-5" />
              Giờ làm thực tế trong tháng ({filteredMonthlyHours.length})
            </CardTitle>
            {(selectedStoreIds.length > 0 || selectedEmployeeIds.length > 0) && (
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Đang lọc theo: {selectedStoreIds.length > 0 && `${selectedStoreIds.length} cửa hàng`}{selectedStoreIds.length > 0 && selectedEmployeeIds.length > 0 && ", "}{selectedEmployeeIds.length > 0 && `${selectedEmployeeIds.length} nhân viên`}
              </p>
            )}
          </div>
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
                <tr className="border-b text-left text-slate-500 dark:border-[#333333] dark:text-[#E0E0E0]">
                  <th className="pb-2 pr-4 font-semibold">Tên</th>
                  <th className="pb-2 pr-4 font-semibold">Chức vụ</th>
                  <th className="pb-2 pr-4 font-semibold">Giờ làm chính</th>
                  <th className="pb-2 pr-4 font-semibold">Giờ làm thêm</th>
                  <th className="pb-2 pr-4 font-semibold">Tổng giờ thực tế</th>
                  <th className="pb-2 pr-4 font-semibold">Ca thực tế</th>
                  <th className="pb-2 pr-4 font-semibold">Giờ tối đa</th>
                  <th className="pb-2 pr-4 font-semibold">Chênh lệch giờ</th>
                  <th className="pb-2 pr-4 font-semibold">Chênh lệch ca</th>
                  <th className="pb-2 font-semibold">Số lỗi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyHours.map((emp) => (
                  <tr key={`${emp.id}-${emp.month}`} className="border-b border-slate-100 dark:border-[#333333] dark:hover:bg-[#2D2D30]/40">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-[#E0E0E0]">
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
