"use client";

import { X, Save, Trash2, Shield, Settings2, Users, Building2, CalendarDays, LayoutDashboard, Package, RotateCcw, Crown, AlertTriangle, TrendingUp, ShoppingBag, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

type PendingTransferData = {
  id: string;
  fromUser: { id: string; name: string | null; email: string };
  toUser: { id: string; name: string | null; email: string };
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  member: UserMember | null;
  membersCount: number;
  onSave: (memberId: string, updates: { role: string, companyRoleId: string | null, permissions: any }) => Promise<void>;
  onDelete: (memberId: string) => Promise<void>;
  onTransferOwnership?: (toMemberId: string, toUserId: string) => Promise<void>;
  roles: { id: string; name: string; permissions: any }[];
  canEdit?: boolean;
  currentUserRole?: string;
  activePendingTransfer?: PendingTransferData | null;
  allMembers?: UserMember[];
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

export function MemberPermissionsSheet({ 
  isOpen, 
  onClose, 
  member, 
  membersCount, 
  onSave, 
  onDelete, 
  onTransferOwnership,
  roles, 
  canEdit = true,
  currentUserRole = "EMPLOYEE",
  activePendingTransfer = null,
  allMembers = [],
}: Props) {
  const [role, setRole] = useState<string>("EMPLOYEE");
  const [companyRoleId, setCompanyRoleId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getDefaultPermissionsForRole = (targetRole: string, targetCompanyRoleId: string | null) => {
    if (targetCompanyRoleId) {
      const customRole = roles.find((r) => r.id === targetCompanyRoleId);
      return customRole?.permissions || {};
    }
    if (targetRole === "ADMIN" || targetRole === "OWNER") {
      const allEdit: Record<string, any> = {};
      MODULES.forEach((m) => {
        if (m.id === "employees") allEdit[m.id] = { viewList: true, viewHours: true, edit: true, delete: true };
        else if (m.id === "schedule") allEdit[m.id] = { view: true, edit: true, editFree: true, approve: true, editPast: true };
        else if (m.id === "shift_config") allEdit[m.id] = { view: true, edit: true, delete: true, editPast: true };
        else if (m.id === "audit_log") allEdit[m.id] = { scope: "ALL", view: true };
        else allEdit[m.id] = { view: true, edit: true, delete: true };
      });
      return allEdit;
    }
    if (targetRole === "SCHEDULER") {
      return { 
        schedule: { view: true, edit: true, editFree: true, approve: true, editPast: false }, 
        shift_config: { view: true, edit: true, delete: true, editPast: false } 
      };
    }
    return {};
  };

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setCompanyRoleId(member.companyRoleId || null);

      let initialPerms = member.permissions;
      // If member.permissions is null, undefined, or empty, initialize with default permissions for this role
      if (!initialPerms || (typeof initialPerms === "object" && Object.keys(initialPerms).length === 0)) {
        initialPerms = getDefaultPermissionsForRole(member.role, member.companyRoleId || null);
      }
      setPermissions(initialPerms || {});
    }
  }, [member, roles]);

  const isPermissionsAtDefault = () => {
    const defaultPerms = getDefaultPermissionsForRole(role, companyRoleId);

    const normalize = (obj: any) => {
      if (!obj || typeof obj !== "object") return {};
      const clean: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === "object" && val !== null) {
          const subClean: Record<string, boolean> = {};
          let hasActive = false;
          for (const [subKey, subVal] of Object.entries(val)) {
            if (subVal === true) {
              subClean[subKey] = true;
              hasActive = true;
            }
          }
          if (hasActive) {
            clean[key] = subClean;
          }
        } else if (val && val !== "NONE" && val !== false) {
          clean[key] = val;
        }
      }
      return clean;
    };

    return JSON.stringify(normalize(permissions)) === JSON.stringify(normalize(defaultPerms));
  };

  const handleResetToDefault = () => {
    const defaultPerms = getDefaultPermissionsForRole(role, companyRoleId);
    setPermissions(defaultPerms);
  };

  const handleRoleChange = (val: string) => {
    if (val === "TRANSFER_OWNER") {
      setRole("TRANSFER_OWNER");
      setCompanyRoleId(null);
      return;
    }

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
      setPermissions(getDefaultPermissionsForRole(val, null));
    }
  };


  if (!isOpen || !member || !mounted) return null;

  const isTargetOwner = member.role === "OWNER";
  const isCallerOwner = currentUserRole === "OWNER";
  const isTransferMode = role === "TRANSFER_OWNER";

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isTransferMode) {
        if (onTransferOwnership) {
          await onTransferOwnership(member.id, member.userId);
        }
      } else {
        await onSave(member.id, { role, companyRoleId, permissions });
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isTargetOwner) return;
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

  return createPortal(
    <>
      <div 
        className="fixed inset-0 z-[120] h-[100dvh] w-[100vw] bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      <div className={cn(
        "fixed inset-y-0 right-0 z-[130] w-full max-w-md bg-white dark:bg-[#18181B] dark:border-l dark:border-neutral-800 shadow-2xl transition-transform duration-300 transform",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-neutral-800 px-6 py-4 bg-slate-50/70 dark:bg-[#202024]">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Chi tiết phân quyền</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-7 bg-slate-50/30 dark:bg-[#121212]">
            {/* User Info */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#1C1C20] border border-slate-200/80 dark:border-neutral-700/80 shadow-xs">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white font-bold dark:bg-[#28282C] dark:text-neutral-100 dark:border dark:border-neutral-700 shadow-xs text-xl shrink-0">
                {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{member.user.name || "Chưa cập nhật"}</h3>
                  {isTargetOwner && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black px-2 py-0.5 text-[10px] font-bold shrink-0">
                      <Crown className="h-3 w-3 text-amber-400" /> Chủ sở hữu
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400 font-mono truncate">{member.user.email}</p>
              </div>
            </div>

            <div className={!canEdit || (isTargetOwner && !isCallerOwner) ? "pointer-events-none opacity-90" : ""}>

            {/* Role Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-neutral-200 font-bold text-xs uppercase tracking-wider border-b border-slate-200 dark:border-neutral-800 pb-2">
                <Shield className="h-4 w-4 text-slate-600 dark:text-neutral-400" />
                Chức vụ chính (Role)
              </div>

              {isTargetOwner ? (
                <div className="rounded-xl bg-slate-100 dark:bg-[#202024] p-3 text-xs text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                  Thành viên này hiện đang là <strong>Chủ sở hữu</strong> duy nhất của doanh nghiệp. Để chuyển quyền cho người khác, Chủ sở hữu vui lòng chọn thành viên cần chuyển và chọn <em>&ldquo;Chuyển giao quyền Chủ sở hữu&rdquo;</em>.
                </div>
              ) : (
                <div className="space-y-2">
                  <Select
                    value={role === "TRANSFER_OWNER" ? "TRANSFER_OWNER" : (companyRoleId ? `custom_${companyRoleId}` : role)}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full h-11 dark:bg-[#202024] dark:border-neutral-700 dark:text-white"
                  >
                    <option value="EMPLOYEE">Không có quyền</option>

                    {roles && roles.length > 0 && roles.map(r => (
                      <option key={r.id} value={`custom_${r.id}`}>{r.name}</option>
                    ))}

                    {isCallerOwner && (
                      activePendingTransfer ? (
                        activePendingTransfer.toUser.id === member.user.id ? (
                          <option
                            value="TRANSFER_OWNER"
                            disabled
                          >
                            Đang chờ người này tiếp nhận quyền Chủ sở hữu
                          </option>
                        ) : (
                          <option
                            value="TRANSFER_OWNER"
                            disabled
                            className="text-slate-400 dark:text-neutral-500 opacity-50"
                          >
                            Chuyển giao quyền Chủ sở hữu (Đang có lời mời chờ xử lý)
                          </option>
                        )
                      ) : (
                        <option
                          value="TRANSFER_OWNER"
                        >
                          Chuyển giao quyền Chủ sở hữu
                        </option>
                      )
                    )}
                  </Select>

                  {isCallerOwner && activePendingTransfer && activePendingTransfer.toUser.id !== member.user.id && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Đang có 1 lời mời chuyển quyền gửi tới <strong>{activePendingTransfer.toUser.name || activePendingTransfer.toUser.email}</strong> (<span className="font-mono">{activePendingTransfer.toUser.email}</span>). Bạn cần huỷ lời mời hiện tại trước nếu muốn chuyển giao cho thành viên này.
                      </span>
                    </div>
                  )}

                  {isCallerOwner && activePendingTransfer && activePendingTransfer.toUser.id === member.user.id && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>
                        Đã gửi lời mời chuyển giao quyền Chủ sở hữu cho thành viên này (Đang chờ xác nhận).
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Transfer Ownership Notice Box */}
            {isTransferMode ? (
              <div className="mt-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Xác nhận chuyển giao quyền Chủ sở hữu
                </div>
                <p className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/90">
                  Khi bạn bấm <strong>Gửi lời mời</strong>, hệ thống sẽ gửi một lời mời tiếp quản quyền Chủ sở hữu đến <strong>{member.user.name || member.user.email}</strong>.
                </p>
                <div className="text-xs bg-white/70 dark:bg-black/30 p-3 rounded-xl border border-amber-500/20 space-y-1">
                  <p className="font-semibold">⚠️ Quy trình chuyển giao an toàn:</p>
                  <p>1. Quyền Chủ sở hữu của bạn <strong>chưa mất ngay lập tức</strong>.</p>
                  <p>2. Thành viên này sẽ nhận được thông báo tiếp nhận trong tab Cài đặt & Phân quyền.</p>
                  <p>3. Chỉ sau khi thành viên này bấm <strong>Đồng ý tiếp nhận</strong>, toàn bộ quyền Chủ sở hữu mới được chuyển giao và bạn sẽ chuyển về thành viên thường.</p>
                  <p>4. Bạn có thể huỷ lời mời bất kỳ lúc nào nếu người đó chưa tiếp nhận.</p>
                </div>
              </div>
            ) : (
              /* Detailed Permissions */
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-2">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-neutral-200 font-bold text-xs uppercase tracking-wider">
                    <LayoutDashboard className="h-4 w-4 text-slate-600 dark:text-neutral-400" />
                    Quyền hạn chi tiết
                  </div>

                  {!isTargetOwner && (
                    <button
                      type="button"
                      disabled={isPermissionsAtDefault()}
                      onClick={handleResetToDefault}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border transition-all shadow-xs",
                        isPermissionsAtDefault()
                          ? "opacity-35 cursor-not-allowed text-slate-400 dark:text-neutral-500 border-slate-200/50 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/30"
                          : "text-slate-800 dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 border-slate-200/80 dark:border-neutral-700 cursor-pointer active:scale-95"
                      )}
                      title={isPermissionsAtDefault() ? "Quyền hạn hiện tại đang ở mặc định theo vai trò" : "Khôi phục toàn bộ quyền về mặc định của vai trò này"}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Mặc định
                    </button>
                  )}
                </div>
                
                {isTargetOwner ? (
                  <div className="rounded-2xl bg-slate-100 dark:bg-[#202024] p-4 border border-slate-200 dark:border-neutral-700 text-sm text-slate-800 dark:text-neutral-200 flex items-start gap-3">
                    <Shield className="h-5 w-5 shrink-0 mt-0.5 text-slate-700 dark:text-neutral-300" />
                    <div>
                      <span className="font-bold block mb-1">Toàn quyền tối cao</span>
                      Chủ sở hữu (OWNER) mặc định có toàn quyền tuyệt đối đối với tất cả các phân hệ.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                          if (key === "editFree" && value) {
                            newPerm.edit = true;
                            newPerm.view = true;
                          }
                          if (key === "approve" && value) {
                            newPerm.edit = true;
                            newPerm.view = true;
                          }
                          if (key === "editPast" && value) {
                            newPerm.edit = true;
                            newPerm.view = true;
                          }
                          if (key === "edit" && !value) {
                            newPerm.editFree = false;
                            newPerm.approve = false;
                            newPerm.editPast = false;
                          }
                        } else if (mod.id === "shift_config") {
                          if (key === "edit" && value) newPerm.view = true;
                          if (key === "delete" && value) {
                            newPerm.edit = true;
                            newPerm.view = true;
                          }
                          if (key === "editPast" && value) {
                            newPerm.edit = true;
                            newPerm.view = true;
                          }
                          if (key === "edit" && !value) {
                            newPerm.delete = false;
                            newPerm.editPast = false;
                          }
                        } else if (mod.id === "store") {
                          if (key === "edit" && value) newPerm.view = true;
                          if (key === "delete" && value) {
                            newPerm.edit = true;
                            newPerm.view = true;
                          }
                          if (key === "edit" && !value) newPerm.delete = false;
                        } else {
                          if (key === "edit" && value) newPerm.view = true;
                          if (key === "delete" && value) {
                            newPerm.edit = true;
                            newPerm.view = true;
                          }
                          if (key === "edit" && !value) newPerm.delete = false;
                        }

                        if (!Object.values(newPerm).some(v => v === true)) {
                          updatePermission(mod.id, "NONE");
                        } else {
                          updatePermission(mod.id, newPerm);
                        }
                      };

                      const Icon = mod.icon;

                      return (
                        <div key={mod.id} className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-white dark:bg-[#1C1C20] shadow-xs transition-all duration-200">
                          {/* Module Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 dark:bg-[#28282C] rounded-lg text-slate-800 dark:text-neutral-200 border border-slate-200/80 dark:border-neutral-700">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white text-sm">{mod.label}</span>
                              </div>
                            </div>
                            <Switch
                              checked={isModuleEnabled}
                              disabled={!canEdit}
                              onCheckedChange={toggleModule}
                            />
                          </div>

                          {/* Detail Permissions Accordion */}
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
                                          <Switch checked={!!perm.viewList || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("viewList", c)} className="scale-90" />
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm text-slate-700 dark:text-neutral-300">Giờ làm thực tế trong tháng</span>
                                          <Switch checked={!!perm.viewHours || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("viewHours", c)} className="scale-90" />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-3 pt-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                        <Switch checked={!!perm.edit} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                      </div>
                                      <div className={cn("grid transition-all duration-300 ease-in-out", perm.edit ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
                                        <div className="overflow-hidden">
                                          <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700 pt-1 pb-1">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-slate-700 dark:text-neutral-300">Xoá nhân viên</span>
                                              <Switch checked={!!perm.delete} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
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
                                      <Switch checked={!!perm.view || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                    </div>
                                    <div className="space-y-3 pt-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                        <Switch checked={!!perm.edit} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                      </div>
                                      <div className={cn("grid transition-all duration-300 ease-in-out", perm.edit ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
                                        <div className="overflow-hidden">
                                          <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700 pt-1 pb-1">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-slate-700 dark:text-neutral-300">Toàn quyền xếp ca</span>
                                              <Switch checked={!!perm.editFree} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("editFree", c)} className="scale-90" />
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-slate-700 dark:text-neutral-300">Duyệt yêu cầu</span>
                                              <Switch checked={!!perm.approve} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("approve", c)} className="scale-90" />
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <div className="space-y-0.5">
                                                <span className="text-sm text-slate-700 dark:text-neutral-300">Chỉnh sửa lịch sử ca làm</span>
                                                <p className="text-[11px] text-slate-500 dark:text-neutral-400">Cho phép thêm, sửa, xoá ca trước ngày hiện tại</p>
                                              </div>
                                              <Switch checked={!!perm.editPast} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("editPast", c)} className="scale-90" />
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
                                      <Switch checked={!!perm.view || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                    </div>
                                    <div className="space-y-3 pt-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                        <Switch checked={!!perm.edit} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                      </div>
                                      <div className={cn("grid transition-all duration-300 ease-in-out", perm.edit ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
                                        <div className="overflow-hidden">
                                          <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700 pt-1 pb-1">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-slate-700 dark:text-neutral-300">Xoá cửa hàng</span>
                                              <Switch checked={!!perm.delete} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
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
                                            name={`audit_scope_${member.id}`}
                                            value="SELF"
                                            checked={currentScope === "SELF"}
                                            disabled={!canEdit}
                                            onChange={() => updatePermission("audit_log", { scope: "SELF", view: true })}
                                            className="mt-0.5"
                                          />
                                          <div className="text-xs">
                                            <span className="font-bold text-slate-900 dark:text-white block">Chỉ xem của chính mình</span>
                                            <span className="text-slate-500 dark:text-neutral-400">Chỉ xem các thao tác do chính tài khoản này thực hiện</span>
                                          </div>
                                        </label>

                                        {/* Option 2: CUSTOM */}
                                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700/70 hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors">
                                          <input
                                            type="radio"
                                            name={`audit_scope_${member.id}`}
                                            value="CUSTOM"
                                            checked={currentScope === "CUSTOM"}
                                            disabled={!canEdit}
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
                                                allMembers.filter((m) => m.user.id !== member.user.id).map((m) => {
                                                  const isChecked = Boolean((perm?.allowedUserIds || []).includes(m.user.id));
                                                  const toggleUser = (checked: boolean) => {
                                                    const current = perm?.allowedUserIds || [];
                                                    const updated = checked
                                                      ? [...current, m.user.id]
                                                      : current.filter((id: string) => id !== m.user.id);
                                                    updatePermission("audit_log", { ...perm, scope: "CUSTOM", view: true, allowedUserIds: updated });
                                                  };
                                                  return (
                                                    <label key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#1A1A1E] border border-slate-200/80 dark:border-neutral-700/80 text-xs cursor-pointer shadow-2xs">
                                                      <div className="min-w-0 pr-2">
                                                        <span className="font-bold text-slate-900 dark:text-white block truncate">{m.user.name || m.user.email}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono block truncate">{m.user.email}</span>
                                                      </div>
                                                      <Switch
                                                        checked={isChecked}
                                                        disabled={!canEdit}
                                                        onCheckedChange={toggleUser}
                                                        className="scale-75 shrink-0"
                                                      />
                                                    </label>
                                                  );
                                                })
                                              ) : (
                                                <p className="text-[11px] text-slate-400">Không có thành viên khác để chọn</p>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Option 3: ALL */}
                                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700/70 hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors">
                                          <input
                                            type="radio"
                                            name={`audit_scope_${member.id}`}
                                            value="ALL"
                                            checked={currentScope === "ALL"}
                                            disabled={!canEdit}
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
                                      <Switch checked={!!perm.view || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                    </div>
                                    <div className="space-y-3 pt-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
                                        <Switch checked={!!perm.edit} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("edit", c)} className="scale-90" />
                                      </div>
                                      <div className={cn("grid transition-all duration-300 ease-in-out", perm.edit ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
                                        <div className="overflow-hidden">
                                          <div className="pl-4 space-y-3 border-l-2 border-slate-200 dark:border-neutral-700 pt-1 pb-1">
                                            <div className="flex items-center justify-between">
                                              <div className="space-y-0.5">
                                                <span className="text-sm text-slate-700 dark:text-neutral-300">Xoá cấu hình ca</span>
                                                <p className="text-[11px] text-slate-500 dark:text-neutral-400">Cho phép xoá ca và bảng cấu hình</p>
                                              </div>
                                              <Switch checked={!!perm.delete} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("delete", c)} className="scale-90" />
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <div className="space-y-0.5">
                                                <span className="text-sm text-slate-700 dark:text-neutral-300">Chỉnh sửa lịch sử ca làm</span>
                                                <p className="text-[11px] text-slate-500 dark:text-neutral-400">Cho phép sửa định biên và ca trước ngày hiện tại</p>
                                              </div>
                                              <Switch checked={!!perm.editPast} disabled={!canEdit} onCheckedChange={(c) => updatePermObj("editPast", c)} className="scale-90" />
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
                                      <Switch checked={!!perm.view || !!perm.edit} disabled={!canEdit || !!perm.edit} onCheckedChange={(c) => updatePermObj("view", c)} className="scale-90" />
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-400">Chỉnh sửa</span>
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
            )}
            
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200/80 dark:border-neutral-800 p-4 bg-slate-50/70 dark:bg-[#202024] flex items-center justify-between gap-3 shrink-0">
            {canEdit ? (
              <>
                <div>
                  {!isTargetOwner && (
                    <Button 
                      variant="ghost" 
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs h-10 px-3"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      {isDeleting ? "Đang xoá..." : "Xoá"}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={onClose} 
                    className="dark:bg-[#28282C] dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 text-xs h-10 px-4"
                  >
                    Huỷ
                  </Button>
                  {!isTargetOwner && (
                    <Button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold shadow-xs text-xs h-10 px-4 whitespace-nowrap"
                    >
                      {isSaving ? "Đang xử lý..." : (
                        isTransferMode ? (
                          <>
                            <Crown className="mr-1.5 h-4 w-4 text-amber-400" /> Gửi lời mời
                          </>
                        ) : (
                          <>
                            <Save className="mr-1.5 h-4 w-4" /> Lưu thay đổi
                          </>
                        )
                      )}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full flex justify-end">
                <Button variant="outline" onClick={onClose} className="dark:bg-[#28282C] dark:border-neutral-700 dark:text-neutral-200 text-xs h-10 px-4">
                  Đóng
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
