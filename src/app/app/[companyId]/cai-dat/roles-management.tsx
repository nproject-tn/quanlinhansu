"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Settings2, Trash2, Shield, CalendarDays, Building2, Users, Package, ShoppingBag, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotifications } from "@/components/notifications/notification-center";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type CompanyRole = {
  id: string;
  name: string;
  permissions: any;
};

const MODULES = [
  { id: "schedule", label: "Lịch xếp ca", icon: CalendarDays },
  { id: "store", label: "Cửa hàng", icon: Building2 },
  { id: "products", label: "Hàng hoá", icon: Package },
  { id: "revenue", label: "Đơn hàng & Bán hàng", icon: ShoppingBag },
  { id: "employees", label: "Nhân sự", icon: Users },
  { id: "shift_config", label: "Cấu hình ca", icon: Settings2 },
  { id: "settings", label: "Cài đặt & Phân quyền", icon: Shield },
  { id: "audit_log", label: "Lịch sử thao tác", icon: History },
];

const DEFAULT_ROLES = [
  { id: "OWNER", name: "Chủ sở hữu (Mặc định hệ thống)" },
];

export function RolesManagement({ 
  companyId, 
  roles, 
  mutate, 
  canEdit,
  allMembers = [],
}: { 
  companyId: string, 
  roles: CompanyRole[], 
  mutate: () => void, 
  canEdit: boolean,
  allMembers?: any[],
}) {
  const { notify } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CompanyRole | null>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    setName("");
    setPermissions({});
    setIsOpen(true);
  };

  const openEdit = (role: CompanyRole) => {
    setEditingRole(role);
    setName(role.name);
    setPermissions(role.permissions || {});
    setIsOpen(true);
  };

  const updatePermission = (moduleId: string, value: any) => {
    if (value === "NONE") {
      const newPerms = { ...permissions };
      delete newPerms[moduleId];
      setPermissions(newPerms);
    } else {
      setPermissions({ ...permissions, [moduleId]: value });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notify({ tone: "error", title: "Lỗi", body: "Tên vai trò không được để trống" });
      return;
    }

    setIsLoading(true);
    try {
      const url = editingRole ? `/api/settings/roles/${editingRole.id}` : `/api/settings/roles`;
      const method = editingRole ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Update failed");
      }

      notify({ tone: "success", title: "Thành công", body: editingRole ? "Đã cập nhật vai trò" : "Đã tạo vai trò mới" });
      mutate();
      setIsOpen(false);
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi lưu vai trò" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc muốn xoá vai trò này? Các nhân viên đang dùng vai trò này sẽ trở về quyền nhân viên mặc định.")) return;
    
    try {
      const res = await fetch(`/api/settings/roles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Delete failed");
      }
      notify({ tone: "success", title: "Thành công", body: "Đã xoá vai trò" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi xoá vai trò" });
    }
  };

  return (
    <>
      <Card className="border-none shadow-sm overflow-hidden bg-white/90 dark:bg-[#18181B] dark:border dark:border-neutral-800 glass-control">
        <CardHeader className="bg-slate-50/70 dark:bg-[#202024] border-b border-slate-200/80 dark:border-neutral-800 p-4 sm:px-6 sm:py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Danh sách vai trò ({DEFAULT_ROLES.length + roles.length})</CardTitle>
          {canEdit && (
            <Button onClick={openCreate} size="sm" variant="outline" className="border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold shadow-xs dark:border-neutral-700 dark:bg-[#202024] dark:text-neutral-200 dark:hover:bg-[#28282C] dark:hover:text-white text-xs h-9">
              <Plus className="mr-1.5 h-4 w-4" /> Tạo vai trò tuỳ chỉnh
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-slate-500 bg-slate-50/50 dark:border-neutral-800 dark:text-neutral-300 dark:bg-[#1C1C20]">
                  <th className="px-6 py-3.5 font-bold">Tên vai trò</th>
                  {canEdit && <th className="px-6 py-3.5 font-bold text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {DEFAULT_ROLES.map((r) => (
                  <tr key={r.id} className="border-b dark:border-neutral-800/80 bg-slate-50/30 dark:bg-neutral-800/20">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {r.name}
                      <span className="ml-2.5 inline-flex items-center rounded-full bg-slate-100 dark:bg-[#242428] px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-neutral-300 uppercase tracking-wide border border-slate-200 dark:border-neutral-700">
                        Mặc định
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        {/* Default roles cannot be deleted or edited */}
                      </td>
                    )}
                  </tr>
                ))}
                
                {roles.map((role) => (
                  <tr key={role.id} className="border-b last:border-0 hover:bg-slate-50/80 dark:border-neutral-800/80 dark:hover:bg-neutral-800/40">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {role.name}
                      <span className="ml-2.5 inline-flex items-center rounded-full bg-slate-100 dark:bg-[#242428] px-2.5 py-0.5 text-[10px] font-bold text-slate-800 dark:text-neutral-200 uppercase tracking-wide border border-slate-200 dark:border-neutral-700">
                        Tuỳ chỉnh
                      </span>
                    </td>

                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEdit(role)}
                          className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 font-semibold mr-1.5"
                        >
                          <Settings2 className="h-4 w-4 mr-1.5 text-slate-500 dark:text-neutral-400" /> Sửa
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => handleDelete(e, role.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 animate-in fade-in backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-neutral-800 bg-white dark:bg-[#202024] shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingRole ? "Sửa vai trò" : "Tạo vai trò mới"}</h3>
            </div>
            <div className="p-6 space-y-6 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-[#121212]">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider block mb-1.5">Tên vai trò</label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Ví dụ: Kế toán, Cửa hàng trưởng..." 
                  className="dark:bg-[#202024] dark:border-neutral-700 dark:text-white"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider block border-b border-slate-200 dark:border-neutral-800 pb-2">Quyền mặc định</label>
                {MODULES.map((mod) => {
                  const currentValue = permissions[mod.id];
                  const perm: any = (typeof currentValue === "object" && currentValue !== null) ? { ...(currentValue as any) } : {};
                  
                  if (typeof currentValue === "string" && currentValue !== "NONE") {
                    if (mod.id === "schedule") {
                      if (currentValue === "APPROVER") Object.assign(perm, { view: true, edit: true, editFree: true, approve: true });
                      else if (currentValue === "EDIT_FREE" || currentValue === "EDIT") Object.assign(perm, { view: true, edit: true, editFree: true });
                      else if (currentValue === "EDIT_REQUEST") Object.assign(perm, { view: true, edit: true });
                      else if (currentValue === "VIEW") Object.assign(perm, { view: true });
                    } else {
                      if (currentValue === "EDIT") Object.assign(perm, { view: true, edit: true, delete: true });
                      else if (currentValue === "VIEW") Object.assign(perm, { view: true });
                    }
                  }

                  const isModuleEnabled = Object.keys(perm).length > 0 && Object.values(perm).some(v => v === true || typeof v === "string" || typeof v === "object");

                  const toggleModule = (enabled: boolean) => {
                    if (enabled) {
                      if (mod.id === "employees") updatePermission(mod.id, { viewList: true, viewHours: true });
                      else if (mod.id === "audit_log") updatePermission(mod.id, { scope: "SELF", view: true });
                      else updatePermission(mod.id, { view: true });
                    } else {
                      updatePermission(mod.id, "NONE");
                    }
                  };

                  const updatePermObj = (key: string, value: boolean) => {
                    let newPerm = { ...perm, [key]: value };
                    
                    if (mod.id === "employees") {
                      if (key === "edit" && value) {
                        newPerm.viewList = true;
                        newPerm.viewHours = true;
                      }
                      if (key === "delete" && value) {
                        newPerm.edit = true;
                        newPerm.viewList = true;
                        newPerm.viewHours = true;
                      }
                      if (key === "edit" && !value) {
                        newPerm.delete = false;
                      }
                    } else if (mod.id === "schedule") {
                      if (key === "edit" && value) {
                        newPerm.view = true;
                      }
                      if (key === "edit" && !value) {
                        newPerm.editFree = false;
                        newPerm.approve = false;
                        newPerm.editPast = false;
                      }
                    } else if (mod.id === "shift_config") {
                      if (key === "edit" && value) {
                        newPerm.view = true;
                      }
                      if (key === "delete" && value) {
                        newPerm.edit = true;
                        newPerm.view = true;
                      }
                      if (key === "edit" && !value) {
                        newPerm.delete = false;
                        newPerm.editPast = false;
                      }
                    } else {
                      if (key === "edit" && value) {
                        newPerm.view = true;
                      }
                      if (key === "delete" && value) {
                        newPerm.edit = true;
                        newPerm.view = true;
                      }
                      if (key === "edit" && !value) {
                        newPerm.delete = false;
                      }
                    }
                    
                    if (!Object.values(newPerm).some(v => v === true)) {
                      updatePermission(mod.id, "NONE");
                    } else {
                      updatePermission(mod.id, newPerm);
                    }
                  };

                  return (
                    <div key={mod.id} className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-white dark:bg-[#1C1C20] shadow-xs transition-all duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-[#28282C] rounded-lg text-slate-800 dark:text-neutral-200 border border-slate-200/80 dark:border-neutral-700">
                            <mod.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{mod.label}</span>
                          </div>
                        </div>
                        <Switch checked={isModuleEnabled} onCheckedChange={toggleModule} />
                      </div>
                      
                      <div className={cn("grid transition-all duration-300 ease-in-out", isModuleEnabled ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none")}>
                        <div className="overflow-hidden">
                          <div className="pl-14 pr-2 space-y-4 pb-1">
                        {mod.id === "employees" ? (
                          <>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉ xem</span>
                              </div>
                              <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-slate-700 dark:text-neutral-300">Danh sách nhân viên</span>
                                  <Switch checked={!!perm.viewList || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("viewList", c)} className="scale-90" />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-slate-700 dark:text-neutral-300">Giờ làm thực tế trong tháng</span>
                                  <Switch checked={!!perm.viewHours || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("viewHours", c)} className="scale-90" />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                <Switch checked={!!perm.edit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                              </div>
                              <div className={cn("grid transition-all duration-300 ease-in-out", perm.edit ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
                                <div className="overflow-hidden">
                                  <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700 pt-1 pb-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-700 dark:text-neutral-300">Xoá nhân viên</span>
                                      <Switch checked={!!perm.delete} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : mod.id === "schedule" ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉ xem</span>
                              <Switch checked={!!perm.view || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                            </div>
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                <Switch checked={!!perm.edit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                              </div>
                              <div className={cn("grid transition-all duration-300 ease-in-out", perm.edit ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
                                <div className="overflow-hidden">
                                  <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700 pt-1 pb-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-700 dark:text-neutral-300">Toàn quyền xếp ca</span>
                                      <Switch checked={!!perm.editFree} onCheckedChange={(c) => updatePermObj("editFree", c)} className="scale-90" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-700 dark:text-neutral-300">Duyệt yêu cầu</span>
                                      <Switch checked={!!perm.approve} onCheckedChange={(c) => updatePermObj("approve", c)} className="scale-90" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="space-y-0.5">
                                        <span className="text-sm text-slate-700 dark:text-neutral-300">Chỉnh sửa lịch sử ca làm</span>
                                        <p className="text-[11px] text-slate-500 dark:text-neutral-400">Cho phép thêm, sửa, xoá ca trước ngày hiện tại</p>
                                      </div>
                                      <Switch checked={!!perm.editPast} onCheckedChange={(c) => updatePermObj("editPast", c)} className="scale-90" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : mod.id === "store" ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉ xem</span>
                              <Switch checked={!!perm.view || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                            </div>
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                <Switch checked={!!perm.edit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                              </div>
                              <div className={cn("grid transition-all duration-300 ease-in-out", perm.edit ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
                                <div className="overflow-hidden">
                                  <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700 pt-1 pb-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-700 dark:text-neutral-300">Xoá cửa hàng</span>
                                      <Switch checked={!!perm.delete} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                                ) : mod.id === "audit_log" ? (() => {
                                  const currentScope: "SELF" | "CUSTOM" | "ALL" = 
                                    perm?.scope === "ALL" ? "ALL" : perm?.scope === "CUSTOM" ? "CUSTOM" : "SELF";

                                  return (
                                    <div className="space-y-3">
                                      <div className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">
                                        Phạm vi xem lịch sử thao tác
                                      </div>

                                      <div className="space-y-2">
                                        {/* Option 1: SELF */}
                                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700/70 hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors">
                                          <input
                                            type="radio"
                                            name="audit_scope_role"
                                            value="SELF"
                                            checked={currentScope === "SELF"}
                                            onChange={() => updatePermission("audit_log", { scope: "SELF", view: true })}
                                            className="mt-0.5"
                                          />
                                          <div className="text-xs">
                                            <span className="font-bold text-slate-900 dark:text-white block">Chỉ xem của chính mình</span>
                                            <span className="text-slate-500 dark:text-neutral-400">Chỉ xem các thao tác do chính tài khoản người dùng thực hiện</span>
                                          </div>
                                        </label>

                                        {/* Option 2: CUSTOM */}
                                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700/70 hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors">
                                          <input
                                            type="radio"
                                            name="audit_scope_role"
                                            value="CUSTOM"
                                            checked={currentScope === "CUSTOM"}
                                            onChange={() => updatePermission("audit_log", { scope: "CUSTOM", view: true, allowedUserIds: perm?.allowedUserIds || [] })}
                                            className="mt-0.5"
                                          />
                                          <div className="text-xs flex-1">
                                            <span className="font-bold text-slate-900 dark:text-white block">Xem của nhân viên/email cụ thể</span>
                                            <span className="text-slate-500 dark:text-neutral-400">Chỉ định các tài khoản nhân sự được phép xem lịch sử</span>
                                          </div>
                                        </label>

                                        {/* If CUSTOM is selected, show list of members to pick */}
                                        {currentScope === "CUSTOM" && (
                                          <div className="pl-3 pr-1 py-2 space-y-2 border-l-2 border-slate-300 dark:border-neutral-600 bg-slate-50/80 dark:bg-[#222226] rounded-r-xl">
                                            <span className="text-[11px] font-semibold text-slate-600 dark:text-neutral-300 block">
                                              Chọn các nhân viên được phép xem:
                                            </span>
                                            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                                              {allMembers && allMembers.length > 0 ? (
                                                allMembers.map((m: any) => {
                                                  const userId = m.user?.id || m.userId;
                                                  const isChecked = Boolean((perm?.allowedUserIds || []).includes(userId));
                                                  const toggleUser = (checked: boolean) => {
                                                    const current = perm?.allowedUserIds || [];
                                                    const updated = checked
                                                      ? [...current, userId]
                                                      : current.filter((id: string) => id !== userId);
                                                    updatePermission("audit_log", { ...perm, scope: "CUSTOM", view: true, allowedUserIds: updated });
                                                  };
                                                  return (
                                                    <label key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#1A1A1E] border border-slate-200/80 dark:border-neutral-700/80 text-xs cursor-pointer shadow-2xs">
                                                      <div className="min-w-0 pr-2">
                                                        <span className="font-bold text-slate-900 dark:text-white block truncate">{m.user?.name || m.user?.email || m.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono block truncate">{m.user?.email || m.email}</span>
                                                      </div>
                                                      <Switch
                                                        checked={isChecked}
                                                        onCheckedChange={toggleUser}
                                                        className="scale-75 shrink-0"
                                                      />
                                                    </label>
                                                  );
                                                })
                                              ) : (
                                                <p className="text-[11px] text-slate-400">Không có thành viên để chọn</p>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Option 3: ALL */}
                                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700/70 hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors">
                                          <input
                                            type="radio"
                                            name="audit_scope_role"
                                            value="ALL"
                                            checked={currentScope === "ALL"}
                                            onChange={() => updatePermission("audit_log", { scope: "ALL", view: true })}
                                            className="mt-0.5"
                                          />
                                          <div className="text-xs">
                                            <span className="font-bold text-slate-900 dark:text-white block">Xem toàn bộ lịch sử hệ thống</span>
                                            <span className="text-slate-500 dark:text-neutral-400">Xem mọi thao tác của tất cả thành viên trong doanh nghiệp</span>
                                          </div>
                                        </label>
                                      </div>

                                      {/* Immutability Notice */}
                                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800/60 text-[11px] text-slate-500 dark:text-neutral-400 flex items-center gap-2 border border-slate-200/60 dark:border-neutral-700/60">
                                        <Shield className="h-4 w-4 text-slate-400 shrink-0" />
                                        <span>Lịch sử thao tác là dữ liệu kiểm toán hệ thống và không thể xoá hay chỉnh sửa.</span>
                                      </div>
                                    </div>
                                  );
                                })() : mod.id === "shift_config" ? (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉ xem</span>
                                      <Switch checked={!!perm.view || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                    </div>
                                    <div className="space-y-3 pt-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                        <Switch checked={!!perm.edit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                      </div>
                                      <div className={cn("grid transition-all duration-300 ease-in-out", perm.edit ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
                                        <div className="overflow-hidden">
                                          <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700 pt-1 pb-1">
                                            <div className="flex items-center justify-between">
                                              <div className="space-y-0.5">
                                                <span className="text-sm text-slate-700 dark:text-neutral-300">Xoá cấu hình ca</span>
                                                <p className="text-[11px] text-slate-500 dark:text-neutral-400">Cho phép xoá ca và bảng cấu hình</p>
                                              </div>
                                              <Switch checked={!!perm.delete} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <div className="space-y-0.5">
                                                <span className="text-sm text-slate-700 dark:text-neutral-300">Chỉnh sửa lịch sử ca làm</span>
                                                <p className="text-[11px] text-slate-500 dark:text-neutral-400">Cho phép sửa định biên và ca trước ngày hiện tại</p>
                                              </div>
                                              <Switch checked={!!perm.editPast} onCheckedChange={(c) => updatePermObj("editPast", c)} className="scale-90" />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉ xem</span>
                                      <Switch checked={!!perm.view || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                      <Switch checked={!!perm.edit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
                <div className="p-6 flex justify-end gap-3 border-t border-slate-100 dark:border-neutral-800 shrink-0 bg-white dark:bg-[#202024]">
                  <Button variant="outline" onClick={() => setIsOpen(false)} className="dark:bg-[#28282C] dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">Huỷ</Button>
                  <Button onClick={handleSave} disabled={isLoading} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold shadow-xs">
                    {isLoading ? "Đang lưu..." : "Lưu vai trò"}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
      }
    </>
  );
}
