"use client";

import { useState } from "react";
import { Plus, Settings2, Trash2, Shield, CalendarDays, Building2, Users, Package } from "lucide-react";
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
  { id: "employees", label: "Nhân sự", icon: Users },
  { id: "shift_config", label: "Cấu hình ca", icon: Settings2 },
  { id: "settings", label: "Cài đặt & Phân quyền", icon: Shield },
];

const DEFAULT_ROLES = [
  { id: "OWNER", name: "Chủ sở hữu (Mặc định hệ thống)" },
];

export function RolesManagement({ companyId, roles, mutate, canEdit }: { companyId: string, roles: CompanyRole[], mutate: () => void, canEdit: boolean }) {
  const { notify } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CompanyRole | null>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

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
      <Card className="border-none shadow-sm overflow-hidden bg-white/80 glass-control">
        <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-row items-center justify-between">
          <CardTitle>Danh sách vai trò ({DEFAULT_ROLES.length + roles.length})</CardTitle>
          {canEdit && (
            <Button onClick={openCreate} size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <Plus className="mr-2 h-4 w-4" /> Tạo vai trò tuỳ chỉnh
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500 bg-slate-50/30">
                  <th className="px-6 py-4 font-medium">Tên vai trò</th>
                  {canEdit && <th className="px-6 py-4 font-medium text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {DEFAULT_ROLES.map((r) => (
                  <tr key={r.id} className="border-b bg-slate-50/30">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {r.name}
                      <span className="ml-2 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
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
                  <tr key={role.id} className="border-b last:border-0 hover:bg-slate-50/80">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {role.name}
                      <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">
                        Tuỳ chỉnh
                      </span>
                    </td>

                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEdit(role)}
                          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 mr-2"
                        >
                          <Settings2 className="h-4 w-4 mr-2" /> Sửa
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => handleDelete(e, role.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4">
            <div className="p-6 border-b shrink-0">
              <h3 className="text-xl font-bold">{editingRole ? "Sửa vai trò" : "Tạo vai trò mới"}</h3>
            </div>
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Tên vai trò</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Kế toán, Cửa hàng trưởng..." />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 block border-b pb-2">Quyền mặc định</label>
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

                  const isModuleEnabled = Object.keys(perm).length > 0 && Object.values(perm).some(v => v === true);

                  const toggleModule = (enabled: boolean) => {
                    if (enabled) {
                      if (mod.id === "employees") updatePermission(mod.id, { viewList: true, viewHours: true });
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
                      <div key={mod.id} className="flex flex-col p-4 rounded-xl border bg-white shadow-sm transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-lg text-indigo-600 border border-slate-100">
                              <mod.icon className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800">{mod.label}</span>
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
                                  <span className="text-sm font-medium text-slate-700">Chỉ xem</span>
                                </div>
                                <div className="pl-4 space-y-3 border-l-2 border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Danh sách nhân viên</span>
                                    <Switch checked={!!perm.viewList || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("viewList", c)} className="scale-90" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Giờ làm thực tế trong tháng</span>
                                    <Switch checked={!!perm.viewHours || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("viewHours", c)} className="scale-90" />
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">Chỉnh sửa</span>
                                  <Switch checked={!!perm.edit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                </div>
                                <div className="pl-4 space-y-3 border-l-2 border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Xoá nhân viên</span>
                                    <Switch checked={!!perm.delete} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : mod.id === "schedule" ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Chỉ xem</span>
                                <Switch checked={!!perm.view || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                              </div>
                              <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">Chỉnh sửa</span>
                                  <Switch checked={!!perm.edit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                </div>
                                {!!perm.edit && (
                                  <div className="pl-4 space-y-3 border-l-2 border-slate-100 animate-in slide-in-from-top-2 fade-in">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-600">Toàn quyền xếp ca</span>
                                      <Switch checked={!!perm.editFree} onCheckedChange={(c) => updatePermObj("editFree", c)} className="scale-90" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-600">Duyệt yêu cầu</span>
                                      <Switch checked={!!perm.approve} onCheckedChange={(c) => updatePermObj("approve", c)} className="scale-90" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : mod.id === "store" ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Chỉ xem</span>
                                <Switch checked={!!perm.view || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                              </div>
                              <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">Chỉnh sửa</span>
                                  <Switch checked={!!perm.edit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                </div>
                                <div className="pl-4 space-y-3 border-l-2 border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Xoá cửa hàng</span>
                                    <Switch checked={!!perm.delete} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700">Chỉ xem</span>
                                <Switch checked={!!perm.view || !!perm.edit} disabled={!!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                              </div>
                              <div className="flex items-center justify-between pt-2">
                                <span className="text-sm font-medium text-slate-700">Chỉnh sửa</span>
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
            <div className="p-6 flex justify-end gap-3 border-t shrink-0 rounded-b-xl bg-slate-50">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Huỷ</Button>
              <Button onClick={handleSave} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
                {isLoading ? "Đang lưu..." : "Lưu vai trò"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
