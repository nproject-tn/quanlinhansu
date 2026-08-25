"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Plus, Settings2, Sun, Moon, Laptop, Palette, Check, Crown, AlertTriangle, X, CheckCircle2, ArrowRight, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNotifications } from "@/components/notifications/notification-center";
import { InviteUserModal } from "@/components/employees/invite-user-modal";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { MemberPermissionsSheet } from "./member-permissions-sheet";
import { RolesManagement } from "./roles-management";
import { CompanySettings } from "./company-settings";
import { ROLE_LABELS, cn } from "@/lib/utils";

type UserMember = {
  id: string;
  userId: string;
  companyId: string;
  role: string;
  permissions: any;
  companyRoleId?: string | null;
  companyRole?: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

type CompanyRole = {
  id: string;
  name: string;
  permissions: any;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt?: string;
};

type PendingTransferData = {
  id: string;
  fromUser: { id: string; name: string | null; email: string };
  toUser: { id: string; name: string | null; email: string };
};

type SettingsData = {
  members: UserMember[];
  invitations: Invitation[];
  roles: CompanyRole[];
  pendingTransfer?: PendingTransferData | null;
};

type Props = {
  companyId: string;
  userRole: string;
  currentUserId?: string;
  canEdit: boolean;
  pendingTransfer?: {
    id: string;
    fromName: string | null;
    fromEmail: string;
    companyName: string;
  } | null;
  hasSettingsAccess?: boolean;
};

export function SettingsClient({ 
  companyId, 
  userRole, 
  currentUserId,
  canEdit,
  pendingTransfer: initialPendingTransfer,
  hasSettingsAccess = true,
}: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showOwnerLeaveModal, setShowOwnerLeaveModal] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("");
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserMember | null>(null);
  const [isRespondingTransfer, setIsRespondingTransfer] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load");
    return res.json();
  };

  const { data, mutate } = useSWR<SettingsData>(hasSettingsAccess ? `/api/settings/members` : null, fetcher);

  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];
  const roles = data?.roles ?? [];
  const activePendingTransfer = data?.pendingTransfer;

  const handleRespondTransfer = async (transferId: string, action: "ACCEPT" | "REJECT") => {
    setIsRespondingTransfer(true);
    try {
      const res = await fetch(`/api/settings/ownership-transfer/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId, action }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Thao tác thất bại");

      if (action === "ACCEPT") {
        notify({ tone: "success", title: "Thành công", body: result.message || "Bạn đã trở thành Chủ sở hữu!" });
        window.location.reload();
      } else {
        notify({ tone: "warning", title: "Đã từ chối", body: "Bạn đã từ chối lời mời làm Chủ sở hữu" });
        window.location.href = `/app/${companyId}`;
      }
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi phản hồi lời mời" });
    } finally {
      setIsRespondingTransfer(false);
    }
  };

  const handleTransferOwnership = async (toMemberId: string, toUserId: string) => {
    try {
      const res = await fetch(`/api/settings/ownership-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toMemberId, toUserId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gửi lời mời thất bại");

      notify({ tone: "success", title: "Đã gửi lời mời", body: result.message || "Đã gửi lời mời chuyển giao quyền Chủ sở hữu" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi gửi lời mời" });
      throw err;
    }
  };

  const handleCancelTransfer = async () => {
    if (!confirm("Bạn có chắc chắn muốn huỷ yêu cầu chuyển giao quyền Chủ sở hữu này?")) return;
    try {
      const res = await fetch(`/api/settings/ownership-transfer`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Huỷ thất bại");

      notify({ tone: "success", title: "Đã huỷ", body: "Đã huỷ lời mời chuyển giao quyền Chủ sở hữu" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi huỷ yêu cầu" });
    }
  };

  const handleSaveMember = async (memberId: string, updates: { role: string, companyRoleId: string | null, permissions: any }) => {
    try {
      const res = await fetch(`/api/settings/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          ...updates
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Update failed");
      }

      notify({ tone: "success", title: "Thành công", body: "Đã lưu thay đổi phân quyền" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi lưu thay đổi" });
      throw err;
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/settings/members?memberId=${memberId}`, {
        method: "DELETE",
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Delete failed");

      notify({ tone: "success", title: "Thành công", body: "Đã xoá thành viên khỏi doanh nghiệp" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi xoá thành viên" });
      throw err;
    }
  };

  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      setCancellingInviteId(invitationId);
      const res = await fetch(`/api/settings/invitations?id=${invitationId}`, {
        method: "DELETE",
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Huỷ lời mời thất bại");

      notify({ tone: "success", title: "Thành công", body: "Đã huỷ lời mời thành công" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi huỷ lời mời" });
    } finally {
      setCancellingInviteId(null);
    }
  };

  const handleLeaveCompany = async () => {
    try {
      setIsLeaving(true);
      const res = await fetch("/api/companies/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Rời doanh nghiệp thất bại");

      notify({ tone: "success", title: "Đã rời doanh nghiệp", body: "Bạn đã rời khỏi doanh nghiệp thành công." });
      setShowLeaveModal(false);
      router.push("/workspaces");
      router.refresh();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi rời doanh nghiệp" });
    } finally {
      setIsLeaving(false);
    }
  };

  const handleOwnerLeaveTransfer = async () => {
    if (!selectedNewOwnerId) {
      notify({ tone: "error", title: "Chưa chọn người nhận", body: "Vui lòng chọn thành viên tiếp quản quyền Chủ sở hữu" });
      return;
    }

    setIsTransferringOwnership(true);
    try {
      const res = await fetch("/api/settings/ownership-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: selectedNewOwnerId }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gửi lời mời thất bại");

      notify({
        tone: "success",
        title: "Đã gửi lời mời",
        body: "Đã gửi lời mời tiếp quản quyền Chủ sở hữu. Bạn sẽ tự động rời khỏi doanh nghiệp khi người nhận chấp thuận.",
      });
      setShowOwnerLeaveModal(false);
      setSelectedNewOwnerId("");
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi gửi lời mời" });
    } finally {
      setIsTransferringOwnership(false);
    }
  };

  // Case 1: User does NOT have general settings permission, but received an Ownership Transfer Invitation
  if (!hasSettingsAccess && initialPendingTransfer) {
    return (
      <div className="max-w-2xl mx-auto pt-8 space-y-6">
        <Card className="border border-amber-500/40 shadow-xl overflow-hidden bg-white/95 dark:bg-[#18181B] dark:border-amber-500/30">
          <CardHeader className="bg-amber-500/10 border-b border-amber-500/20 p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  Lời mời tiếp quản quyền Chủ sở hữu (Owner)
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-neutral-300 text-xs mt-1">
                  Doanh nghiệp: <strong className="text-slate-900 dark:text-white font-semibold">{initialPendingTransfer.companyName}</strong>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="rounded-2xl bg-slate-50 dark:bg-[#202024] p-5 border border-slate-200 dark:border-neutral-700 space-y-3">
              <p className="text-sm text-slate-700 dark:text-neutral-200 leading-relaxed">
                Chủ sở hữu hiện tại là <strong>{initialPendingTransfer.fromName || initialPendingTransfer.fromEmail}</strong> (<span className="font-mono text-xs text-slate-500 dark:text-neutral-400">{initialPendingTransfer.fromEmail}</span>) đã gửi lời mời chuyển giao toàn bộ quyền sở hữu và quản trị doanh nghiệp này cho bạn.
              </p>
              <div className="text-xs text-slate-600 dark:text-neutral-400 space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-neutral-700/80">
                <p className="font-semibold text-slate-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  Khi bạn đồng ý tiếp nhận:
                </p>
                <p>• Bạn sẽ trở thành <strong>Chủ sở hữu duy nhất (Owner)</strong> với toàn quyền tuyệt đối đối với tất cả phân hệ.</p>
                <p>• Chủ sở hữu trước đó sẽ tự động chuyển thành thành viên thường.</p>
                <p>• Toàn bộ quyền truy cập vào Cài đặt, Cửa hàng, Nhân sự, Lịch xếp ca... sẽ mở ra cho bạn.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                disabled={isRespondingTransfer}
                onClick={() => handleRespondTransfer(initialPendingTransfer.id, "REJECT")}
                className="w-full sm:w-auto text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white"
              >
                <X className="mr-1.5 h-4 w-4" /> Từ chối
              </Button>
              <Button
                disabled={isRespondingTransfer}
                onClick={() => handleRespondTransfer(initialPendingTransfer.id, "ACCEPT")}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold shadow-md h-11 px-6"
              >
                {isRespondingTransfer ? "Đang xử lý..." : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400 dark:text-emerald-600" /> Tiếp nhận quyền Chủ sở hữu
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const themeOptions: { value: Theme; label: string; desc: string; icon: any }[] = [
    {
      value: "light",
      label: "Giao diện sáng",
      desc: "Nền trắng thanh lịch, độ tương phản sắc nét",
      icon: Sun,
    },
    {
      value: "dark",
      label: "Giao diện tối",
      desc: "Tông Đen & Xám Charcoal hiện đại, êm dịu cho mắt",
      icon: Moon,
    },
    {
      value: "system",
      label: "Tự động (Theo OS)",
      desc: `Tự động đồng bộ theo hệ điều hành (hiện tại: ${resolvedTheme === "dark" ? "Tối" : "Sáng"})`,
      icon: Laptop,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Thông tin doanh nghiệp */}
      <CompanySettings companyId={companyId} canEdit={canEdit} />

      {/* Cài đặt Giao diện Theme */}
      <Card className="border-none shadow-sm overflow-hidden bg-white/80 dark:bg-neutral-900/90 glass-control">
        <CardHeader className="bg-slate-50/50 dark:bg-neutral-800/40 border-b dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-slate-700 dark:text-neutral-300" />
            <CardTitle>Giao diện hiển thị</CardTitle>
          </div>
          <CardDescription className="dark:text-neutral-400">
            Tùy chỉnh chế độ sáng, tối hoặc tự động đồng bộ theo cài đặt hệ thống của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = mounted ? theme === opt.value : opt.value === "system";
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-2xl border text-left transition-all relative cursor-pointer",
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white shadow-md dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-slate-200 bg-white/70 hover:bg-slate-50 text-slate-900 dark:border-neutral-800 dark:bg-neutral-850 dark:hover:bg-neutral-800 dark:text-neutral-100"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-xl flex items-center justify-center",
                        isSelected
                          ? "bg-white/20 text-white dark:bg-neutral-900/10 dark:text-neutral-900"
                          : "bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-white text-slate-900 dark:bg-neutral-900 dark:text-white flex items-center justify-center">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-sm">{opt.label}</span>
                  <span
                    className={cn(
                      "text-xs mt-1 leading-relaxed",
                      isSelected ? "text-slate-200 dark:text-neutral-600" : "text-slate-500 dark:text-neutral-400"
                    )}
                  >
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Banner for user who received an ownership transfer invitation (if they already have settings access) */}
      {initialPendingTransfer && (
        <Card className="border border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-500/40 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Lời mời tiếp quản quyền Chủ sở hữu (Owner)
                </h4>
                <p className="text-xs text-slate-600 dark:text-neutral-300 mt-0.5">
                  <strong>{initialPendingTransfer.fromName || initialPendingTransfer.fromEmail}</strong> ({initialPendingTransfer.fromEmail}) đã gửi lời mời chuyển giao quyền Chủ sở hữu doanh nghiệp cho bạn.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={isRespondingTransfer}
                onClick={() => handleRespondTransfer(initialPendingTransfer.id, "REJECT")}
                className="text-xs h-9"
              >
                Từ chối
              </Button>
              <Button
                size="sm"
                disabled={isRespondingTransfer}
                onClick={() => handleRespondTransfer(initialPendingTransfer.id, "ACCEPT")}
                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold text-xs h-9 shadow-sm"
              >
                {isRespondingTransfer ? "Đang xử lý..." : "Tiếp nhận quyền"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danh sách thành viên */}
      <Card className="border-none shadow-sm overflow-hidden bg-white/90 dark:bg-[#18181B] dark:border dark:border-neutral-800 glass-control">
        <CardHeader className="bg-slate-50/70 dark:bg-[#202024] border-b border-slate-200/80 dark:border-neutral-800 p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Danh sách thành viên ({members.length})</CardTitle>
            <CardDescription className="dark:text-neutral-400 text-xs mt-0.5">Quản lý tài khoản truy cập và phân quyền chi tiết cho từng thành viên</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => setShowInviteModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm font-bold w-full sm:w-auto text-xs h-9">
              <Plus className="mr-1.5 h-4 w-4" /> Mời thành viên
            </Button>
          )}
        </CardHeader>

        {/* Sender notice banner if Owner sent an ownership transfer */}
        {userRole === "OWNER" && activePendingTransfer && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
              <Crown className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                Đang chờ <strong>{activePendingTransfer.toUser.name || activePendingTransfer.toUser.email}</strong> (<span className="font-mono">{activePendingTransfer.toUser.email}</span>) xác nhận tiếp nhận quyền Chủ sở hữu.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelTransfer}
              className="text-xs h-7 px-2.5 text-amber-900 border-amber-300 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/40 shrink-0"
            >
              Huỷ lời mời
            </Button>
          </div>
        )}

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-slate-500 bg-slate-50/50 dark:border-[#333333] dark:text-[#E0E0E0] dark:bg-[#1E1E1E]">
                  <th className="px-6 py-3 font-bold">Thành viên</th>
                  <th className="px-6 py-3 font-bold">Vai trò</th>
                  <th className="px-6 py-3 font-bold">Trạng thái</th>
                  <th className="px-6 py-3 font-bold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#333333]">
                {members.map((member) => {
                  const isRecipientOfPendingTransfer = activePendingTransfer && activePendingTransfer.toUser.id === member.user.id;
                  const isMemberOwner = member.role === "OWNER";

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/60 dark:hover:bg-[#2D2D30]/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-[#1E1E1E] dark:border dark:border-[#3C3C3C] flex items-center justify-center font-bold text-slate-700 dark:text-white uppercase text-sm shrink-0">
                            {member.user.name ? member.user.name.charAt(0) : "U"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{member.user.name || "Chưa cập nhật"}</span>
                              {isRecipientOfPendingTransfer && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-full px-2 py-0.2">
                                  <Crown className="h-2.5 w-2.5" /> Chờ nhận Chủ sở hữu
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500 dark:text-[#A0A0A0] text-xs font-mono">{member.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                          isMemberOwner 
                            ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-black dark:border-white font-bold" 
                            : "bg-slate-100 text-slate-800 border-slate-200 dark:bg-[#2D2D30] dark:text-[#E0E0E0] dark:border-[#3C3C3C]"
                        )}>
                          {isMemberOwner ? "Chủ sở hữu" : member.companyRole?.name || (member.role === "EMPLOYEE" ? "Không có quyền" : ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Đang hoạt động
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(() => {
                          const isSelf = currentUserId && (member.userId === currentUserId || member.user.id === currentUserId);

                          if (isSelf) {
                            return (
                              <div className="flex items-center justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (isMemberOwner) {
                                      setSelectedNewOwnerId("");
                                      setShowOwnerLeaveModal(true);
                                    } else {
                                      setShowLeaveModal(true);
                                    }
                                  }}
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/30 font-semibold"
                                >
                                  <LogOut className="h-4 w-4 mr-1.5" /> Thoát
                                </Button>
                              </div>
                            );
                          }

                          // Non-self members:
                          if (isMemberOwner && userRole !== "OWNER") {
                            return (
                              <div className="flex items-center justify-end">
                                <span className="text-xs text-slate-400 dark:text-neutral-500 font-medium italic">
                                  Chủ sở hữu (Bảo vệ)
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div className="flex items-center justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedMember(member)}
                                className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-[#CCCCCC] dark:hover:text-white dark:hover:bg-[#2D2D30] font-semibold"
                              >
                                <Settings2 className="h-4 w-4 mr-1.5 text-slate-500 dark:text-[#A0A0A0]" />
                                {canEdit ? "Phân quyền" : "Xem quyền"}
                              </Button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card className="border-none shadow-sm overflow-hidden bg-white/90 dark:bg-[#18181B] dark:border dark:border-neutral-800 glass-control">
          <CardHeader className="bg-slate-50/70 dark:bg-[#202024] border-b border-slate-200/80 dark:border-neutral-800 p-4 sm:px-6 sm:py-4">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Lời mời đang chờ ({invitations.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-slate-500 bg-slate-50/50 dark:border-[#333333] dark:text-[#E0E0E0] dark:bg-[#1E1E1E]">
                    <th className="px-6 py-3 font-bold">Email</th>
                    <th className="px-6 py-3 font-bold">Vai trò</th>
                    <th className="px-6 py-3 font-bold">Ngày gửi</th>
                    {canEdit && <th className="px-6 py-3 font-bold text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#333333]">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-[#2D2D30]/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white font-mono">{inv.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-[#2D2D30] px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:text-[#E0E0E0] border border-slate-200 dark:border-[#3C3C3C]">
                          {(inv as any).companyRole?.name || (inv.role === "EMPLOYEE" ? "Không có quyền" : ROLE_LABELS[inv.role] || inv.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-[#A0A0A0] font-mono text-xs">
                        {new Date(inv.createdAt || inv.expiresAt).toLocaleDateString("vi-VN")}
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={cancellingInviteId === inv.id}
                            onClick={() => handleCancelInvitation(inv.id)}
                            className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            {cancellingInviteId === inv.id ? "Đang huỷ..." : "Huỷ lời mời"}
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
      )}

      <RolesManagement companyId={companyId} roles={roles} mutate={mutate} canEdit={canEdit} />

      {showInviteModal && (
        <InviteUserModal
          companyId={companyId}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => mutate()}
          roles={roles}
          onRoleCreated={() => mutate()}
        />
      )}

      <MemberPermissionsSheet
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
        membersCount={members.length}
        roles={data?.roles || []}
        onSave={handleSaveMember}
        onDelete={handleDeleteMember}
        onTransferOwnership={handleTransferOwnership}
        canEdit={canEdit}
        currentUserRole={userRole}
        activePendingTransfer={activePendingTransfer}
      />

      {/* Confirmation Modal for Leaving Company */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1E1E] dark:border dark:border-[#333333] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Rời khỏi doanh nghiệp</h3>
                <p className="text-xs text-slate-500 dark:text-[#A0A0A0]">Xác nhận huỷ tư cách thành viên</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-[#CCCCCC] leading-relaxed">
              Bạn có chắc chắn muốn rời khỏi doanh nghiệp này? Bạn sẽ mất toàn bộ quyền truy cập và cần được Quản trị viên mời lại nếu muốn tham gia tiếp.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                disabled={isLeaving}
                onClick={() => setShowLeaveModal(false)}
                className="text-xs h-9"
              >
                Huỷ
              </Button>
              <Button
                disabled={isLeaving}
                onClick={handleLeaveCompany}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 shadow-sm"
              >
                {isLeaving ? "Đang rời..." : "Xác nhận rời"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Owner Leaving Company & Transferring Ownership */}
      {showOwnerLeaveModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1E1E] dark:border dark:border-[#333333] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Chuyển giao quyền & Thoát</h3>
                <p className="text-xs text-slate-500 dark:text-[#A0A0A0]">Chỉ định Chủ sở hữu mới để rời doanh nghiệp</p>
              </div>
            </div>

            {(() => {
              const otherMembers = members.filter(m => m.userId !== currentUserId && m.user.id !== currentUserId);

              if (otherMembers.length === 0) {
                return (
                  <div className="space-y-4 pt-1">
                    <p className="text-sm text-slate-600 dark:text-[#CCCCCC] leading-relaxed">
                      Doanh nghiệp hiện chưa có thành viên nào khác để tiếp quản quyền Chủ sở hữu. 
                      Bạn cần mời thêm thành viên trước khi rời đi, hoặc thực hiện <strong>Giải tán doanh nghiệp</strong> ở phần Vùng nguy hiểm nếu không còn nhu cầu sử dụng.
                    </p>
                    <div className="flex items-center justify-end pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowOwnerLeaveModal(false)}
                        className="text-xs h-9 font-semibold"
                      >
                        Đã hiểu
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-4 pt-1">
                  <p className="text-xs text-slate-600 dark:text-[#CCCCCC] leading-relaxed">
                    Mỗi doanh nghiệp cần duy trì một Chủ sở hữu. Hãy chọn một thành viên để tiếp quản. Khi thành viên này chấp nhận lời mời, họ sẽ trở thành Chủ sở hữu mới và <strong>bạn sẽ tự động rời khỏi doanh nghiệp</strong>.
                  </p>

                  {activePendingTransfer && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                      <div>
                        Đang có 1 lời mời chờ <strong>{activePendingTransfer.toUser.name || activePendingTransfer.toUser.email}</strong> xác nhận.
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelTransfer}
                        className="h-7 text-xs text-amber-900 border-amber-300 hover:bg-amber-100 dark:text-amber-200 dark:border-amber-700"
                      >
                        Huỷ lời mời hiện tại để chọn người khác
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
                      Chọn thành viên tiếp quản quyền Chủ sở hữu:
                    </label>
                    <select
                      value={selectedNewOwnerId}
                      onChange={(e) => setSelectedNewOwnerId(e.target.value)}
                      disabled={!!activePendingTransfer || isTransferringOwnership}
                      className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-[#202024] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all disabled:opacity-50"
                    >
                      <option value="">-- Chọn thành viên --</option>
                      {otherMembers.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name ? `${m.user.name} (${m.user.email})` : m.user.email} - {m.companyRole?.name || (m.role === "EMPLOYEE" ? "Không có quyền" : m.role)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      variant="outline"
                      disabled={isTransferringOwnership}
                      onClick={() => {
                        setShowOwnerLeaveModal(false);
                        setSelectedNewOwnerId("");
                      }}
                      className="text-xs h-9"
                    >
                      Huỷ
                    </Button>
                    <Button
                      disabled={!selectedNewOwnerId || !!activePendingTransfer || isTransferringOwnership}
                      onClick={handleOwnerLeaveTransfer}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 shadow-sm"
                    >
                      {isTransferringOwnership ? "Đang gửi..." : "Gửi lời mời & Thoát"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
