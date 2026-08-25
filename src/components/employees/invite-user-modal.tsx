"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { inviteUserToCompany } from "@/app/actions/invite-user";
import { useNotifications } from "@/components/notifications/notification-center";
import { Plus, Shield, X, CalendarDays, Building2, Package, Users, Settings2, Sparkles, Loader2 } from "lucide-react";
import type { UserRole } from "@/generated/prisma/client";

const MODULES = [
  { id: "schedule", label: "Lịch xếp ca", icon: CalendarDays },
  { id: "store", label: "Cửa hàng", icon: Building2 },
  { id: "products", label: "Hàng hoá", icon: Package },
  { id: "employees", label: "Nhân sự", icon: Users },
  { id: "shift_config", label: "Cấu hình ca", icon: Settings2 },
  { id: "settings", label: "Cài đặt & Phân quyền", icon: Shield },
];

export function InviteUserModal({ 
  companyId, 
  isOpen, 
  onClose, 
  onSuccess,
  roles = [],
  onRoleCreated,
}: { 
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  roles?: { id: string; name: string; permissions: any }[];
  onRoleCreated?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [selectedRoleValue, setSelectedRoleValue] = useState<string>("NONE");
  const [loading, setLoading] = useState(false);
  const { notify } = useNotifications();

  // Create Role sub-dialog state
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState<Record<string, any>>({
    schedule: { view: true },
    store: { view: true },
    products: { view: true },
  });
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);

    let baseRole: UserRole = "EMPLOYEE";
    let companyRoleId: string | null = null;

    if (selectedRoleValue.startsWith("custom_")) {
      baseRole = "EMPLOYEE";
      companyRoleId = selectedRoleValue.replace("custom_", "");
    } else {
      baseRole = selectedRoleValue as UserRole;
      companyRoleId = null;
    }

    const result = await inviteUserToCompany(companyId, email, baseRole, companyRoleId);
    setLoading(false);

    if (result.error) {
      notify({ title: "Lỗi", body: result.error, tone: "error" });
    } else {
      notify({ title: "Thành công", body: `Đã gửi lời mời tới ${email}`, tone: "success" });
      onSuccess?.();
      onClose();
    }
  }

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      notify({ tone: "error", title: "Lỗi", body: "Vui lòng nhập tên vai trò" });
      return;
    }

    setIsSubmittingRole(true);
    try {
      const res = await fetch("/api/settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          permissions: newRolePermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi tạo vai trò mới");
      }

      notify({ tone: "success", title: "Thành công", body: `Đã tạo vai trò "${data.name}"` });
      
      // Auto-select the newly created role
      setSelectedRoleValue(`custom_${data.id}`);
      
      // Trigger refresh on parent
      onRoleCreated?.();
      
      // Reset & close sub-dialog
      setNewRoleName("");
      setNewRolePermissions({
        schedule: { view: true },
        store: { view: true },
        products: { view: true },
      });
      setIsCreatingRole(false);
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const toggleModuleInNewRole = (modId: string, enabled: boolean) => {
    if (enabled) {
      if (modId === "employees") {
        setNewRolePermissions(prev => ({ ...prev, [modId]: { viewList: true, viewHours: true } }));
      } else {
        setNewRolePermissions(prev => ({ ...prev, [modId]: { view: true } }));
      }
    } else {
      const copy = { ...newRolePermissions };
      delete copy[modId];
      setNewRolePermissions(copy);
    }
  };

  const updateSubPermInNewRole = (modId: string, actionKey: string, value: boolean) => {
    const current = newRolePermissions[modId] || {};
    setNewRolePermissions(prev => ({
      ...prev,
      [modId]: { ...current, [actionKey]: value }
    }));
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-[#202024]">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-700 dark:text-neutral-300" />
              Mời người dùng vào doanh nghiệp
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                Email người nhận *
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="dark:bg-[#202024] dark:border-neutral-700 dark:text-white h-11"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
                  Chỉ định vai trò *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingRole(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-neutral-200 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-neutral-700 transition-all shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-700 dark:text-neutral-300" />
                  Tạo vai trò
                </button>
              </div>

              <Select
                value={selectedRoleValue}
                onChange={(e) => setSelectedRoleValue(e.target.value)}
                className="w-full h-11 dark:bg-[#202024] dark:border-neutral-700 dark:text-white"
              >
                <option value="NONE">Không có quyền</option>
                {roles && roles.length > 0 && (
                  roles.map((r) => (
                    <option key={r.id} value={`custom_${r.id}`}>
                      {r.name}
                    </option>
                  ))
                )}
              </Select>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#151518] border border-slate-200/70 dark:border-neutral-800">
              <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                💡 Người dùng khi chấp nhận lời mời sẽ tự động nhận vai trò này. Bạn vẫn có thể tùy chỉnh phân quyền chi tiết cho từng thành viên bất cứ lúc nào.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-neutral-800">
              <Button type="button" variant="outline" onClick={onClose} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                Hủy
              </Button>
              <Button type="submit" disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold shadow-xs">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang gửi...
                  </span>
                ) : (
                  "Gửi lời mời"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Sub-Modal: Quick Create Role */}
      {isCreatingRole && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-[#202024] shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-slate-800 dark:text-neutral-200" />
                Tạo vai trò mới
              </h3>
              <button
                onClick={() => setIsCreatingRole(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/30 dark:bg-[#121212]">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                    Tên vai trò mới *
                  </label>
                  <Input
                    required
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Ví dụ: Cửa hàng trưởng, Thu ngân, Kế toán..."
                    className="dark:bg-[#202024] dark:border-neutral-700 dark:text-white h-11"
                    autoFocus
                  />
                </div>

                <div className="space-y-3 pt-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
                    Thiết lập quyền hạn cơ bản
                  </label>

                  <div className="space-y-3">
                    {MODULES.map((mod) => {
                      const Icon = mod.icon;
                      const perm = newRolePermissions[mod.id] || {};
                      const isEnabled = Object.keys(perm).length > 0 && Object.values(perm).some(v => v === true);

                      return (
                        <div key={mod.id} className="rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#1C1C20] p-3 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">{mod.label}</span>
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => toggleModuleInNewRole(mod.id, checked)}
                            />
                          </div>

                          {isEnabled && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-neutral-800/80 flex flex-wrap gap-2 text-xs">
                              {mod.id === "schedule" && (
                                <>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-neutral-300 font-medium">
                                    <input 
                                      type="checkbox" 
                                      checked={perm.edit === true}
                                      onChange={(e) => updateSubPermInNewRole(mod.id, "edit", e.target.checked)}
                                      className="rounded text-slate-900"
                                    />
                                    Xếp ca (Gửi duyệt)
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-neutral-300 font-medium ml-2">
                                    <input 
                                      type="checkbox" 
                                      checked={perm.editFree === true}
                                      onChange={(e) => updateSubPermInNewRole(mod.id, "editFree", e.target.checked)}
                                      className="rounded text-slate-900"
                                    />
                                    Xếp tự do
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-neutral-300 font-medium ml-2">
                                    <input 
                                      type="checkbox" 
                                      checked={perm.approve === true}
                                      onChange={(e) => updateSubPermInNewRole(mod.id, "approve", e.target.checked)}
                                      className="rounded text-slate-900"
                                    />
                                    Duyệt ca
                                  </label>
                                </>
                              )}

                              {mod.id === "employees" && (
                                <>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-neutral-300 font-medium">
                                    <input 
                                      type="checkbox" 
                                      checked={perm.viewHours === true}
                                      onChange={(e) => updateSubPermInNewRole(mod.id, "viewHours", e.target.checked)}
                                      className="rounded text-slate-900"
                                    />
                                    Xem giờ công
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-neutral-300 font-medium ml-2">
                                    <input 
                                      type="checkbox" 
                                      checked={perm.edit === true}
                                      onChange={(e) => updateSubPermInNewRole(mod.id, "edit", e.target.checked)}
                                      className="rounded text-slate-900"
                                    />
                                    Thêm / Sửa
                                  </label>
                                </>
                              )}

                              {mod.id !== "schedule" && mod.id !== "employees" && (
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-neutral-300 font-medium">
                                  <input 
                                    type="checkbox" 
                                    checked={perm.edit === true}
                                    onChange={(e) => updateSubPermInNewRole(mod.id, "edit", e.target.checked)}
                                    className="rounded text-slate-900"
                                  />
                                  Toàn quyền chỉnh sửa
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-[#202024] shrink-0">
                <Button type="button" variant="outline" onClick={() => setIsCreatingRole(false)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                  Hủy
                </Button>
                <Button type="submit" disabled={isSubmittingRole} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold shadow-xs">
                  {isSubmittingRole ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo...
                    </span>
                  ) : (
                    "Lưu & Chọn vai trò này"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
