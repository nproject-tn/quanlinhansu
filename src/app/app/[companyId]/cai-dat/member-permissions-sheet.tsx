"use client";

import { X, Save, Trash2, Shield, Settings2, Users, Building2, CalendarDays, LayoutDashboard, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

type UserMember = {
  id: string;
  userId: string;
  companyId: string;
  role: string;
  permissions: any;
  companyRoleId?: string | null;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  member: UserMember | null;
  membersCount: number;
  onSave: (memberId: string, updates: { role: string, companyRoleId: string | null, permissions: any }) => Promise<void>;
  onDelete: (memberId: string) => Promise<void>;
  roles: { id: string; name: string; permissions: any }[];
  canEdit?: boolean;
};

const MODULES = [
  { id: "schedule", label: "Lịch xếp ca", icon: CalendarDays },
  { id: "store", label: "Cửa hàng", icon: Building2 },
  { id: "products", label: "Hàng hoá", icon: Package },
  { id: "employees", label: "Nhân sự", icon: Users },
  { id: "shift_config", label: "Cấu hình ca", icon: Settings2 },
  { id: "settings", label: "Cài đặt & Phân quyền", icon: Shield },
];

export function MemberPermissionsSheet({ isOpen, onClose, member, membersCount, onSave, onDelete, roles, canEdit = true }: Props) {
  const [role, setRole] = useState<string>("EMPLOYEE");
  const [companyRoleId, setCompanyRoleId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setCompanyRoleId(member.companyRoleId || null);
      setPermissions(member.permissions || {});
    }
  }, [member]);

  const handleRoleChange = (val: string) => {
    if (val.startsWith("custom_")) {
      const customRoleId = val.replace("custom_", "");
      const customRole = roles.find(r => r.id === customRoleId);
      if (customRole) {
        setRole("EMPLOYEE"); // Base role
        setCompanyRoleId(customRole.id);
        setPermissions(customRole.permissions || {});
      }
    } else {
      setRole(val);
      setCompanyRoleId(null);
      // Synchronize permissions for base roles
      if (val === "ADMIN" || val === "OWNER") {
        const allEdit: Record<string, string> = {};
        MODULES.forEach(m => allEdit[m.id] = "EDIT");
        setPermissions(allEdit);
      } else if (val === "SCHEDULER") {
        setPermissions({ schedule: "EDIT", shift_config: "EDIT" });
      } else {
        setPermissions({});
      }
    }
  };

  if (!isOpen || !member) return null;

  const isOwner = role === "OWNER";
  const isOnlyOwner = isOwner && membersCount === 1;

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(member.id, { role, companyRoleId, permissions });
    setIsSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (isOnlyOwner) return;
    if (!confirm(`Bạn có chắc chắn muốn xoá ${member.user.name || member.user.email} khỏi doanh nghiệp?`)) return;
    
    setIsDeleting(true);
    await onDelete(member.id);
    setIsDeleting(false);
    onClose();
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

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] h-[100dvh] w-[100vw] bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className={cn(
        "fixed inset-y-0 right-0 z-[110] w-full max-w-md bg-white shadow-2xl transition-transform duration-300 transform",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-900">Chi tiết phân quyền</h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-md text-2xl">
                {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{member.user.name || "Chưa cập nhật"}</h3>
                <p className="text-sm text-slate-500">{member.user.email}</p>
              </div>
            </div>

            <div className={!canEdit ? "pointer-events-none opacity-90" : ""}>

            {/* Role Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-semibold border-b pb-2">
                <Shield className="h-5 w-5 text-indigo-500" />
                Chức vụ chính (Role)
              </div>
              <Select
                value={companyRoleId ? `custom_${companyRoleId}` : role}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={isOnlyOwner}
                className="w-full h-11"
              >
                <option value="OWNER">Chủ sở hữu (Toàn quyền)</option>
                <option value="EMPLOYEE">Người dùng (Cơ bản)</option>

                {role === "ADMIN" && <option value="ADMIN">Quản trị viên (Cũ)</option>}
                {role === "SCHEDULER" && <option value="SCHEDULER">Người xếp ca (Cũ)</option>}
                
                {roles && roles.length > 0 && roles.map(r => (
                  <option key={r.id} value={`custom_${r.id}`}>{r.name} (Tuỳ chỉnh)</option>
                ))}
              </Select>
              {isOnlyOwner && (
                <p className="text-xs text-amber-600 mt-1">
                  Đây là chủ sở hữu duy nhất. Hãy chuyển quyền cho người khác trước khi thay đổi.
                </p>
              )}
            </div>

            {/* Detailed Permissions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-semibold border-b pb-2">
                <LayoutDashboard className="h-5 w-5 text-indigo-500" />
                Quyền hạn chi tiết
              </div>
              
              {isOwner ? (
                <div className="rounded-xl bg-indigo-50 p-4 border border-indigo-100 text-sm text-indigo-800 flex items-start gap-3">
                  <Shield className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-1">Quyền lực tối cao</span>
                    Chủ sở hữu (OWNER) mặc định có quyền chỉnh sửa đối với tất cả các phân hệ. Không cần thiết lập thêm.
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
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
                          <Switch checked={isModuleEnabled} onCheckedChange={toggleModule} disabled={!canEdit} />
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
                                      <Switch checked={!!perm.viewList || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("viewList", c)} className="scale-90" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-600">Giờ làm thực tế trong tháng</span>
                                      <Switch checked={!!perm.viewHours || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("viewHours", c)} className="scale-90" />
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-3 pt-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">Chỉnh sửa</span>
                                    <Switch checked={!!perm.edit} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                  </div>
                                  <div className="pl-4 space-y-3 border-l-2 border-slate-100">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-600">Xoá nhân viên</span>
                                      <Switch checked={!!perm.delete} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : mod.id === "schedule" ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">Chỉ xem</span>
                                  <Switch checked={!!perm.view || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                </div>
                                <div className="space-y-3 pt-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">Chỉnh sửa</span>
                                    <Switch checked={!!perm.edit} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                  </div>
                                  {!!perm.edit && (
                                    <div className="pl-4 space-y-3 border-l-2 border-slate-100 animate-in slide-in-from-top-2 fade-in">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Toàn quyền xếp ca</span>
                                        <Switch checked={!!perm.editFree} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("editFree", c)} className="scale-90" />
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Duyệt yêu cầu</span>
                                        <Switch checked={!!perm.approve} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("approve", c)} className="scale-90" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : mod.id === "store" ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">Chỉ xem</span>
                                  <Switch checked={!!perm.view || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                </div>
                                <div className="space-y-3 pt-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">Chỉnh sửa</span>
                                    <Switch checked={!!perm.edit} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                  </div>
                                  <div className="pl-4 space-y-3 border-l-2 border-slate-100">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-slate-600">Xoá cửa hàng</span>
                                      <Switch checked={!!perm.delete} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">Chỉ xem</span>
                                  <Switch checked={!!perm.view || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                  <span className="text-sm font-medium text-slate-700">Chỉnh sửa</span>
                                  <Switch checked={!!perm.edit} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
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
              )}
            </div>
            
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-t bg-slate-50/50 p-6 flex items-center justify-between">
            {canEdit ? (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={handleDelete}
                  disabled={isOnlyOwner || isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? "Đang xoá..." : "Xoá"}
                </Button>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Huỷ
                  </Button>
                  <Button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {isSaving ? "Đang lưu..." : (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Lưu thay đổi
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="w-full flex justify-end">
                <Button variant="outline" onClick={onClose}>
                  Đóng
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
