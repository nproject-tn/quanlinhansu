"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import {
  Bell,
  History,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  User,
  Shield,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  CheckCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { useNotifications } from "./notification-center";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatRelativeTime(date: Date | string | number): string {
  const now = Date.now();
  const diffMs = now - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

const ACTION_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  CREATE: { label: "Thêm mới", bg: "bg-emerald-500/10 dark:bg-emerald-950/50", text: "text-emerald-600 dark:text-emerald-400" },
  UPDATE: { label: "Cập nhật", bg: "bg-blue-500/10 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400" },
  DELETE: { label: "Xoá", bg: "bg-rose-500/10 dark:bg-rose-950/50", text: "text-rose-600 dark:text-rose-400" },
  CANCEL: { label: "Huỷ bỏ", bg: "bg-rose-500/10 dark:bg-rose-950/50", text: "text-rose-600 dark:text-rose-400" },
  APPROVE: { label: "Phê duyệt", bg: "bg-emerald-500/10 dark:bg-emerald-950/50", text: "text-emerald-600 dark:text-emerald-400" },
  REJECT: { label: "Từ chối", bg: "bg-amber-500/10 dark:bg-amber-950/50", text: "text-amber-600 dark:text-amber-400" },
  IMPORT: { label: "Nhập dữ liệu", bg: "bg-blue-500/10 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400" },
  EXPORT: { label: "Xuất dữ liệu", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
  LOGIN: { label: "Đăng nhập", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
};

const MODULE_NAMES: Record<string, string> = {
  employees: "Nhân sự",
  schedule: "Lịch xếp ca",
  store: "Cửa hàng",
  shift_config: "Cấu hình ca",
  products: "Hàng hoá",
  revenue: "Đơn hàng & Doanh thu",
  settings: "Cài đặt & Phân quyền",
  auth: "Xác thực",
};

const DETAIL_KEY_LABELS: Record<string, string> = {
  sourceDate: "Từ ngày",
  targetDate: "Đến ngày",
  sourceStoreId: "Từ cửa hàng",
  targetStoreId: "Đến cửa hàng",
  sourceStoreName: "Từ cửa hàng",
  targetStoreName: "Đến cửa hàng",
  sourceShiftName: "Từ ca",
  targetShiftName: "Đến ca",
  sourceShiftTemplateId: "Từ ca",
  targetShiftTemplateId: "Đến ca",
  sourceSlotIndex: "Từ vị trí",
  targetSlotIndex: "Đến vị trí",
  date: "Ngày làm việc",
  shiftTemplateId: "Ca làm việc",
  shiftName: "Ca làm việc",
  shiftTime: "Khung giờ ca",
  dayOfWeek: "Thứ trong tuần",
  requiredStaff: "Định biên nhân sự",
  storeId: "Cửa hàng",
  storeName: "Cửa hàng",
  stores: "Cửa hàng phụ trách",
  assignedStores: "Cửa hàng phụ trách",
  addedStores: "Phân công thêm cửa hàng",
  removedStores: "Gỡ phụ trách tại cửa hàng",
  currentStores: "Cửa hàng phụ trách hiện tại",
  nameChange: "Thay đổi họ tên",
  employeeId: "Nhân viên",
  employeeName: "Nhân viên",
  role: "Mã vai trò",
  roleTitle: "Vai trò áp dụng",
  roleName: "Tên vai trò",
  email: "Email",
  phone: "Số điện thoại",
  address: "Địa chỉ",
  code: "Mã định danh",
  mode: "Chế độ xếp ca",
  referenceDate: "Ngày mốc",
  createdCount: "Số lượng ca đã tạo",
  unfilledCount: "Số ca còn trống",
  deletedCount: "Số lượng ca đã xoá",
  updatedCount: "Số lượng đã cập nhật",
  name: "Tên nhân viên",
  position: "Chức vụ",
  employmentType: "Hình thức làm việc",
  salaryType: "Hình thức tính lương",
  sellingPrice: "Giá bán",
  costPrice: "Giá vốn",
  sku: "Mã SKU",
  barcode: "Mã vạch",
  category: "Danh mục",
  brand: "Thương hiệu",
  count: "Số lượng",
  customerName: "Khách hàng",
  totalAmount: "Tổng tiền thanh toán",
  discountAmount: "Chiết khấu",
  paymentMethod: "Phương thức thanh toán",
  orderStatus: "Trạng thái đơn hàng",
  itemsCount: "Số lượng món",
  softDeleted: "Hình thức xoá",
};

const ENUM_TRANSLATIONS: Record<string, string> = {
  FULL_TIME: "Toàn thời gian (Full-time)",
  PART_TIME: "Bán thời gian (Part-time)",
  TEMPORARY: "Thời vụ",
  HOURLY: "Theo giờ (Hourly)",
  FIXED: "Lương cố định (Fixed)",
  OWNER: "Chủ sở hữu",
  ADMIN: "Quản trị viên",
  SCHEDULER: "Quản lý xếp ca",
  EMPLOYEE: "Nhân viên",
  DELIVERED: "Đã hoàn thành",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã huỷ",
  PENDING: "Chờ xử lý",
  PROCESSING: "Đang xử lý",
  PAID: "Đã thanh toán",
  UNPAID: "Chưa thanh toán",
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  QR_CODE: "Quét mã QR",
};

function renderAuditDetails(details: any) {
  if (!details || typeof details !== "object") return null;

  // Filter out raw JSON permissions or internal arrays that will be rendered separately
  const entries = Object.entries(details).filter(
    ([key]) => key !== "permissions" && key !== "permissionsSummary" && key !== "changesSummary"
  );

  const hasPermSummary = details.permissionsSummary && Array.isArray(details.permissionsSummary) && details.permissionsSummary.length > 0;
  const hasChangesSummary = details.changesSummary && Array.isArray(details.changesSummary) && details.changesSummary.length > 0;

  if (entries.length === 0 && !hasPermSummary && !hasChangesSummary) return null;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-[#333333] dark:bg-[#252528] space-y-3">
      <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
        Dữ liệu chi tiết thao tác
      </span>

      {/* Changes Summary Breakdown */}
      {hasChangesSummary && (
        <div className="space-y-1.5 p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40">
          <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 block">
            Nội dung thay đổi:
          </span>
          <div className="space-y-1">
            {details.changesSummary.map((item: string, idx: number) => (
              <div key={idx} className="flex items-start text-xs text-blue-950 dark:text-blue-200 gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permissions Breakdown Badges */}
      {hasPermSummary && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 block">
            Chi tiết các quyền đã được cấu hình:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {details.permissionsSummary.map((item: string, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-neutral-200 border border-slate-200/90 dark:border-neutral-700/90 shadow-2xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-slate-600 dark:bg-neutral-400 mr-1.5 shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key-value Grid */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {entries.map(([key, value]) => {
            const label = DETAIL_KEY_LABELS[key] || key;
            let displayVal = "";
            if (value === null || value === undefined || value === "") {
              displayVal = "Trống / Không có";
            } else if (typeof value === "object") {
              displayVal = JSON.stringify(value);
            } else if (typeof value === "boolean") {
              displayVal = value ? "Có (Ẩn thay vì xoá hẳn)" : "Không";
            } else if (typeof value === "number") {
              displayVal = value.toLocaleString("vi-VN");
            } else {
              const str = String(value);
              // Translate known enums
              if (ENUM_TRANSLATIONS[str]) {
                displayVal = ENUM_TRANSLATIONS[str];
              } else if ((str.startsWith("cm") || str.startsWith("cl") || str.startsWith("ck")) && str.length >= 24 && !str.includes(" ")) {
                displayVal = "Cửa hàng liên quan";
              } else {
                displayVal = str;
              }
            }

            const isFullWidth = [
              "stores",
              "assignedStores",
              "addedStores",
              "removedStores",
              "currentStores",
              "nameChange",
              "address",
            ].includes(key);

            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col p-2 rounded-lg bg-white dark:bg-[#1E1E1E] border border-slate-100 dark:border-[#333333]/70 shadow-2xs",
                  isFullWidth ? "sm:col-span-2" : ""
                )}
              >
                <span className="text-[10px] font-semibold text-slate-400 dark:text-neutral-400">
                  {label}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white break-words mt-0.5">
                  {displayVal}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NotificationBellTrigger({
  isCollapsed = false,
  companyId,
  userRole,
  permissions,
}: {
  isCollapsed?: boolean;
  companyId: string;
  userRole: string;
  permissions?: any;
}) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notifications" | "audit">("notifications");
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditModuleFilter, setAuditModuleFilter] = useState("ALL");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Local notifications from notification center
  const {
    notifications: localNotifications,
    unreadCount: localUnreadCount,
    markAllAsRead: localMarkRead,
    clearAll: localClearAll,
  } = useNotifications();

  // Can view audit log (OWNER, ADMIN or explicitly granted audit_log permission)
  const canViewAudit =
    userRole === "OWNER" ||
    userRole === "ADMIN" ||
    hasPermission(userRole, permissions, "audit_log", "VIEW");

  // SWR for user notifications
  const { data: notifData, mutate: mutateNotifications } = useSWR(
    `/api/user-notifications`,
    fetcher,
    { refreshInterval: 15000 }
  );

  // SWR for audit logs (only fetched when audit tab is open)
  const auditQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (auditModuleFilter !== "ALL") params.append("module", auditModuleFilter);
    if (auditSearch.trim()) params.append("search", auditSearch.trim());
    params.append("limit", "50");
    return params.toString();
  }, [auditModuleFilter, auditSearch]);

  const { data: auditData, mutate: mutateAudit, isLoading: auditLoading } = useSWR(
    isOpen && activeTab === "audit" && canViewAudit ? `/api/activity-logs?${auditQuery}` : null,
    fetcher
  );

  // Seamlessly merge server notifications with local notifications (e.g. shift toasts, alerts)
  const allNotifications = useMemo(() => {
    const combined = [...(localNotifications || []), ...(notifData?.notifications || [])];
    const seen = new Set<string>();
    const result: any[] = [];
    for (const item of combined) {
      const key = item.id || `${item.title}-${item.body}-${item.createdAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [localNotifications, notifData?.notifications]);

  const unreadCount = (localUnreadCount || 0) + (notifData?.unreadCount || 0);

  // When opening popover, automatically mark all notifications as read
  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open) {
      localMarkRead();
      if ((notifData?.unreadCount || 0) > 0) {
        try {
          await fetch(`/api/user-notifications/mark-read`, { method: "POST" });
          mutateNotifications();
        } catch (e) {
          // ignore
        }
      }
    }
  };

  // Clear all notifications
  const handleClearAllNotifications = async () => {
    localClearAll();
    try {
      await fetch(`/api/user-notifications`, { method: "DELETE" });
      mutateNotifications();
    } catch (e) {
      // ignore
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-[#9D9D9D] dark:hover:bg-[#252526] dark:hover:text-white group",
              isOpen && "bg-slate-100 text-slate-900 dark:bg-[#252526] dark:text-white"
            )}
            title="Thông báo & Lịch sử thao tác"
            aria-label="Thông báo & Lịch sử thao tác"
          >
            <Bell
              className={cn(
                "h-[18px] w-[18px] transition-transform duration-300",
                unreadCount > 0 && "animate-[bell-ring_1.5s_ease-in-out_infinite] text-slate-800 dark:text-white"
              )}
            />

            {/* Red dot unread badge */}
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-white dark:ring-[#181818]"></span>
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          side={isCollapsed ? "right" : "top"}
          align={isCollapsed ? "end" : "start"}
          sideOffset={12}
          className="w-[min(380px,calc(100vw-2rem))] p-0 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl dark:border-[#333333] dark:bg-[#1C1C20]/95 overflow-hidden z-[110]"
        >
          {/* Header with Tabs */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 dark:border-[#2C2C2C] bg-slate-50/50 dark:bg-[#222226]/50">
            <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-[#2A2A2E] p-1 rounded-xl">
              {/* Tab 1: Thông báo */}
              <button
                onClick={() => setActiveTab("notifications")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  activeTab === "notifications"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-[#181818] dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                )}
              >
                <Bell className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                <span>Thông báo</span>
                {unreadCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Tab 2: Lịch sử thao tác (Nếu có quyền) */}
              {canViewAudit && (
                <button
                  onClick={() => setActiveTab("audit")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeTab === "audit"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-[#181818] dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                  )}
                >
                  <History className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                  <span>Lịch sử thao tác</span>
                </button>
              )}
            </div>

            {/* Header Right Action */}
            {activeTab === "notifications" && allNotifications.length > 0 && (
              <button
                onClick={handleClearAllNotifications}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors"
                title="Xoá tất cả"
              >
                Xoá tất cả
              </button>
            )}

            {activeTab === "audit" && (
              <button
                onClick={() => mutateAudit()}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors p-1"
                title="Làm mới"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* TAB 1: THÔNG BÁO (iOS/Dynamic Island Style) */}
          {activeTab === "notifications" && (
            <div className="max-h-[380px] overflow-y-auto p-3 space-y-2.5">
              {allNotifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-neutral-500">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-[#252528] mx-auto mb-2 text-slate-400 dark:text-neutral-500">
                    <Bell className="h-6 w-6 opacity-60 text-slate-800 dark:text-neutral-300" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Chưa có thông báo mới</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Các thông báo công việc, đơn hàng và xếp ca sẽ hiển thị tại đây.</p>
                </div>
              ) : (
                allNotifications.map((notif: any) => {
                  let Icon = Bell;
                  let iconBg = "bg-slate-900 text-white dark:bg-white dark:text-slate-900";
                  if (notif.tone === "success") {
                    Icon = CheckCircle2;
                    iconBg = "bg-emerald-500 text-white";
                  } else if (notif.tone === "error") {
                    Icon = AlertCircle;
                    iconBg = "bg-rose-500 text-white";
                  } else if (notif.tone === "warning") {
                    Icon = AlertTriangle;
                    iconBg = "bg-amber-500 text-white";
                  }

                  return (
                    <div
                      key={notif.id}
                      className="group/notif relative flex items-start gap-3 p-3 rounded-2xl bg-slate-50/80 hover:bg-slate-100/90 dark:bg-[#242428] dark:hover:bg-[#2B2B30] border border-slate-200/60 dark:border-[#333333]/80 transition-all shadow-xs"
                    >
                      {/* App / Notification Icon */}
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-xs", iconBg)}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Content & Relative Time */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] font-medium text-slate-400 dark:text-neutral-400 shrink-0">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-neutral-300 mt-0.5 leading-relaxed">
                          {notif.body}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: LỊCH SỬ THAO TÁC (AUDIT LOGS) */}
          {activeTab === "audit" && (
            <div className="flex flex-col max-h-[420px]">
              {/* Search & Filter Bar */}
              <div className="p-2.5 border-b border-slate-100 dark:border-[#2C2C2C] flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Tìm nhân viên, hành động, đối tượng..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-slate-50 dark:bg-[#252528] border-slate-200 dark:border-[#333333]"
                  />
                </div>

                <select
                  value={auditModuleFilter}
                  onChange={(e) => setAuditModuleFilter(e.target.value)}
                  className="h-8 px-2 text-[11px] font-medium rounded-lg border border-slate-200 bg-slate-50 dark:border-[#333333] dark:bg-[#252528] text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="ALL">Tất cả phân hệ</option>
                  <option value="employees">Nhân sự</option>
                  <option value="schedule">Lịch xếp ca</option>
                  <option value="store">Cửa hàng</option>
                  <option value="shift_config">Cấu hình ca</option>
                  <option value="products">Hàng hoá</option>
                  <option value="revenue">Đơn hàng & Doanh thu</option>
                  <option value="settings">Cài đặt & Phân quyền</option>
                </select>
              </div>

              {/* Logs List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {auditLoading ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-800 dark:text-slate-200" />
                    <span className="text-xs">Đang tải lịch sử thao tác...</span>
                  </div>
                ) : !auditData?.logs || auditData.logs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 dark:text-neutral-500">
                    <History className="h-6 w-6 mx-auto mb-2 opacity-50 text-slate-500 dark:text-neutral-400" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Chưa có lịch sử thao tác nào</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Các thao tác tạo, sửa, xoá của nhân viên sẽ được tự động ghi lại tại đây.</p>
                  </div>
                ) : (
                  auditData.logs.map((log: any) => {
                    const actionBadge = ACTION_BADGES[log.action] || {
                      label: log.action,
                      bg: "bg-slate-100 dark:bg-slate-800",
                      text: "text-slate-600 dark:text-slate-300",
                    };
                    const moduleName = MODULE_NAMES[log.module] || log.module;

                    return (
                      <div
                        key={log.id}
                        className="flex flex-col p-2.5 rounded-xl border border-slate-200/70 bg-white dark:border-[#333333]/80 dark:bg-[#242428] hover:border-slate-300 dark:hover:border-[#444444] transition-all shadow-2xs"
                      >
                        {/* Top Line: Actor + Action Badge + Relative Time */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white dark:bg-slate-200 dark:text-slate-900">
                              {log.userName?.charAt(0) || "U"}
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {log.userName}
                            </span>
                            <span className={cn("px-1.5 py-0.2 rounded-md text-[10px] font-semibold", actionBadge.bg, actionBadge.text)}>
                              {actionBadge.label}
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-400 dark:text-neutral-400 shrink-0 font-medium">
                            {formatRelativeTime(log.createdAt)}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-700 dark:text-neutral-200 mt-1.5 leading-snug">
                          {log.description}
                        </p>

                        {/* Bottom Metadata & View Details Button */}
                        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-[#333333]/60 flex items-center justify-between text-[10px] text-slate-400">
                          <span className="bg-slate-100 dark:bg-[#1E1E1E] px-1.5 py-0.5 rounded text-slate-500 dark:text-neutral-400 font-medium">
                            {moduleName}
                          </span>

                          <button
                            onClick={() => setSelectedAuditLog(log)}
                            className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white font-bold underline underline-offset-2"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Xem chi tiết</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* MODAL: AUDIT LOG DETAILS (PORTAL TO DOCUMENT.BODY TO PREVENT SIDEBAR STACKING CONFLICTS) */}
      {mounted &&
        selectedAuditLog &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1E1E1E] dark:border dark:border-[#333333] animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#333333]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800 dark:bg-[#2A2A2A] dark:text-white border border-slate-200 dark:border-[#3A3A3A]">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Chi tiết thao tác hệ thống</h3>
                    <p className="text-xs text-slate-400">Xem lại nội dung và dữ liệu thay đổi</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedAuditLog(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2C2C2C]"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="py-4 space-y-3.5 text-xs">
                {/* Actor Info Card */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#252528] border border-slate-200/70 dark:border-[#333333] space-y-1.5">
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Người thực hiện</span>
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {selectedAuditLog.userName}
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 dark:bg-[#333333] dark:text-neutral-200 text-[11px] font-semibold">
                      {selectedAuditLog.userRole}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-neutral-400">
                    Email: {selectedAuditLog.userEmail}
                  </div>
                </div>

                {/* Action & Time Details Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#252528] border border-slate-200/70 dark:border-[#333333]">
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px] mb-1">Hành động</span>
                    <span className={cn("px-2 py-0.5 rounded-md text-xs font-bold inline-block", ACTION_BADGES[selectedAuditLog.action]?.bg, ACTION_BADGES[selectedAuditLog.action]?.text)}>
                      {ACTION_BADGES[selectedAuditLog.action]?.label || selectedAuditLog.action}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#252528] border border-slate-200/70 dark:border-[#333333]">
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px] mb-1">Thời gian thao tác</span>
                    <div className="font-medium text-slate-800 dark:text-neutral-200">
                      {new Date(selectedAuditLog.createdAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>

                {/* Module & Target Info */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#252528] border border-slate-200/70 dark:border-[#333333] space-y-1">
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Phân hệ thao tác</span>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {MODULE_NAMES[selectedAuditLog.module] || selectedAuditLog.module}
                    {selectedAuditLog.targetName && selectedAuditLog.targetName !== "ShiftAssignment" ? ` • ${selectedAuditLog.targetName}` : ""}
                  </div>
                  <p className="text-slate-600 dark:text-neutral-300 text-xs mt-1">
                    {selectedAuditLog.description}
                  </p>
                </div>

                {/* Structured Details Card */}
                {selectedAuditLog.details && renderAuditDetails(selectedAuditLog.details)}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#333333] flex justify-end">
                <Button
                  onClick={() => setSelectedAuditLog(null)}
                  className="h-9 px-6 bg-slate-900 text-white hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-semibold rounded-xl shadow-xs"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
