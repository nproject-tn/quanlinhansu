"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ShoppingBag,
  ShoppingCart,
  DollarSign,
  Package,
  Store as StoreIcon,
  Search,
  Download,
  RefreshCw,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  TrendingUp,
  Globe,
  Share2,
  Printer,
  Layers,
  BarChart3,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotifications } from "@/components/notifications/notification-center";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

// Channel display metadata
const CHANNEL_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  POS_STORE: {
    label: "Tại quầy (POS)",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    icon: StoreIcon,
  },
  SHOPEE: {
    label: "Shopee",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
    icon: ShoppingCart,
  },
  TIKTOK_SHOP: {
    label: "TikTok Shop",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-900 dark:text-zinc-100",
    border: "border-zinc-300 dark:border-zinc-700",
    icon: Smartphone,
  },
  LAZADA: {
    label: "Lazada",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800",
    icon: Globe,
  },
  WEBSITE: {
    label: "Website",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: Globe,
  },
  FACEBOOK: {
    label: "Facebook / COD",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-400",
    border: "border-sky-200 dark:border-sky-800",
    icon: Share2,
  },
  ZALO: {
    label: "Zalo / COD",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-400",
    border: "border-teal-200 dark:border-teal-800",
    icon: Share2,
  },
  MANUAL_OTHER: {
    label: "Kênh khác",
    bg: "bg-slate-50 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    icon: Layers,
  },
};

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DELIVERED: { label: "Hoàn tất", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  SHIPPING: { label: "Đang giao", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800", icon: Truck },
  PROCESSING: { label: "Đang xử lý", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800", icon: Clock },
  PENDING: { label: "Chờ xác nhận", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800", icon: Clock },
  CANCELLED: { label: "Đã huỷ", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800", icon: XCircle },
  RETURNED: { label: "Hoàn trả", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800", icon: RefreshCw },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PAID: { label: "Đã thanh toán", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  UNPAID: { label: "Chưa thanh toán", color: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300" },
  PARTIAL_PAID: { label: "Thanh toán 1 phần", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  REFUNDED: { label: "Đã hoàn tiền", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" },
};

export function OrdersClient({
  companyId,
  userRole,
  canEdit,
  canDelete,
}: {
  companyId: string;
  userRole: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();

  // Filters State
  const [dateRangeFilter, setDateRangeFilter] = useState<"TODAY" | "7DAYS" | "THIS_MONTH" | "LAST_MONTH" | "ALL">("THIS_MONTH");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [selectedStore, setSelectedStore] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals & Collapsible State
  const [showRevenueSummary, setShowRevenueSummary] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<any | null>(null);
  const [isEcommerceModalOpen, setIsEcommerceModalOpen] = useState(false);

  // Compute fromDate & toDate
  const dateParams = useMemo(() => {
    const now = new Date();
    if (dateRangeFilter === "TODAY") {
      const today = now.toISOString().slice(0, 10);
      return { fromDate: today, toDate: today };
    }
    if (dateRangeFilter === "7DAYS") {
      const past = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { fromDate: past.toISOString().slice(0, 10), toDate: now.toISOString().slice(0, 10) };
    }
    if (dateRangeFilter === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      return { fromDate: start, toDate: end };
    }
    if (dateRangeFilter === "LAST_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      return { fromDate: start, toDate: end };
    }
    return { fromDate: "", toDate: "" };
  }, [dateRangeFilter]);

  // Query string for API
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedChannel !== "ALL") params.append("channel", selectedChannel);
    if (selectedStore !== "ALL") params.append("storeId", selectedStore);
    if (selectedStatus !== "ALL") params.append("orderStatus", selectedStatus);
    if (selectedPaymentStatus !== "ALL") params.append("paymentStatus", selectedPaymentStatus);
    if (searchQuery.trim()) params.append("search", searchQuery.trim());
    if (dateParams.fromDate) params.append("fromDate", dateParams.fromDate);
    if (dateParams.toDate) params.append("toDate", dateParams.toDate);
    params.append("limit", "100");
    return params.toString();
  }, [selectedChannel, selectedStore, selectedStatus, selectedPaymentStatus, searchQuery, dateParams]);

  // Fetch orders and summary
  const { data: ordersData, mutate: mutateOrders, isLoading: ordersLoading } = useSWR(
    `/api/orders?${queryString}`,
    fetcher
  );

  const { data: summaryData, mutate: mutateSummary, isLoading: summaryLoading } = useSWR(
    `/api/revenue/summary?${queryString}`,
    fetcher
  );

  const { data: rawStores } = useSWR<any[]>("/api/stores", fetcher);
  const stores = Array.isArray(rawStores) ? rawStores : [];
  const orders = Array.isArray(ordersData?.orders) ? ordersData.orders : [];

  // Handle order cancel
  const handleCancelOrder = async (orderId: string, orderCode: string) => {
    const approved = await confirm({
      title: `Huỷ đơn hàng ${orderCode}?`,
      description: "Hệ thống sẽ hoàn trả lại số lượng tồn kho cho các sản phẩm trong đơn hàng này.",
      confirmLabel: "Xác nhận huỷ",
      cancelLabel: "Bỏ qua",
      tone: "destructive",
    });

    if (!approved) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không huỷ được đơn hàng");

      notify({
        title: "Thành công",
        body: `Đã huỷ đơn hàng ${orderCode} và hoàn tồn kho!`,
        tone: "success",
      });
      mutateOrders();
      mutateSummary();
      if (selectedOrderForDetail?.id === orderId) {
        setSelectedOrderForDetail(null);
      }
    } catch (err: any) {
      notify({
        title: "Lỗi",
        body: err.message,
        tone: "error",
      });
    }
  };

  // Export orders to CSV
  const handleExportCSV = () => {
    if (!orders || orders.length === 0) {
      notify({ title: "Thông báo", body: "Không có dữ liệu đơn hàng để xuất.", tone: "warning" });
      return;
    }

    const headers = [
      "Mã đơn",
      "Ngày đặt",
      "Kênh bán",
      "Cửa hàng",
      "Khách hàng",
      "Số điện thoại",
      "Địa chỉ",
      "Tổng tiền hàng",
      "Giảm giá",
      "Phí ship",
      "Thực thu",
      "Phương thức TT",
      "Trạng thái TT",
      "Trạng thái đơn",
      "Mã đơn sàn",
      "Mã vận đơn",
    ];

    const rows = orders.map((o: any) => [
      o.code,
      new Date(o.orderDate).toLocaleDateString("vi-VN"),
      CHANNEL_CONFIG[o.channel]?.label || o.channel,
      o.store?.name || "Kênh Online",
      o.customerName || o.customer?.name || "Khách lẻ",
      o.customerPhone || o.customer?.phone || "",
      `"${(o.customerAddress || o.customer?.address || "").replace(/"/g, '""')}"`,
      o.totalAmount,
      o.discountAmount,
      o.shippingFee,
      o.finalAmount,
      o.paymentMethod,
      PAYMENT_STATUS_CONFIG[o.paymentStatus]?.label || o.paymentStatus,
      ORDER_STATUS_CONFIG[o.orderStatus]?.label || o.orderStatus,
      o.externalOrderId || "",
      o.externalTrackingCode || "",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_cao_don_hang_${dateRangeFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShoppingBag className="h-7 w-7 text-slate-900 dark:text-white" />
            Quản lý Đơn hàng & Doanh thu
          </h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
            Ghi nhận và đối soát toàn bộ đơn hàng từ Sàn TMĐT (Shopee, TikTok Shop), Website, Mạng xã hội và Bán lẻ tại quầy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEcommerceModalOpen(true)}
            className="h-9 gap-1.5 border-slate-300 dark:border-[#333333] hover:bg-slate-100 dark:hover:bg-[#2A2A2A]"
          >
            <Smartphone className="h-4 w-4 text-orange-500" />
            <span>Kết nối Sàn TMĐT</span>
          </Button>

          {/* User Request: Button to open Standalone POS screen in a new tab */}
          <Link href={`/pos/${companyId}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="h-9 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm font-semibold">
              <ShoppingCart className="h-4 w-4" />
              <span>Lên đơn Bán hàng (POS)</span>
              <ExternalLink className="h-3 w-3 ml-0.5 opacity-70" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Date Quick Filter & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Date Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 dark:bg-[#252526] p-1.5 rounded-2xl w-fit border border-slate-200/60 dark:border-[#333333]">
          {[
            { key: "TODAY", label: "Hôm nay" },
            { key: "7DAYS", label: "7 ngày qua" },
            { key: "THIS_MONTH", label: "Tháng này" },
            { key: "LAST_MONTH", label: "Tháng trước" },
            { key: "ALL", label: "Toàn thời gian" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDateRangeFilter(tab.key as any)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200",
                dateRangeFilter === tab.key
                  ? "bg-white text-slate-900 shadow-sm dark:bg-[#333333] dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Buttons: Nút Xuất Excel nằm sát cạnh trái nút Chi tiết doanh thu */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-[#333333] text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-[#2A2A2A]"
          >
            <Download className="h-4 w-4" />
            <span>Xuất Excel</span>
          </Button>

          {/* Button to toggle Detailed Revenue Report */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRevenueSummary(!showRevenueSummary)}
            className={cn(
              "h-9 gap-2 rounded-xl text-xs font-semibold border transition-all select-none",
              showRevenueSummary
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm"
                : "border-slate-300 dark:border-[#333333] text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-[#2A2A2A]"
            )}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Chi tiết doanh thu</span>
            {summaryData?.totalRevenue !== undefined && (
              <span className={cn("font-bold", showRevenueSummary ? "text-emerald-400 dark:text-emerald-600" : "text-emerald-600 dark:text-emerald-400")}>
                ({formatVND(summaryData.totalRevenue)})
              </span>
            )}
            {showRevenueSummary ? (
              <ChevronUp className="h-3.5 w-3.5 opacity-70" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            )}
          </Button>
        </div>
      </div>

      {/* Collapsible Revenue Details (KPI Cards + Channel Breakdown) */}
      {showRevenueSummary && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Tổng doanh thu */}
            <Card className="border border-slate-200/80 bg-white/70 backdrop-blur-md dark:border-[#333333] dark:bg-[#1E1E1E]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  Tổng doanh thu thực thu
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {formatVND(summaryData?.totalRevenue || 0)}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                  <span>Đã trừ giảm giá & phí ship</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Lợi nhuận gộp */}
            <Card className="border border-slate-200/80 bg-white/70 backdrop-blur-md dark:border-[#333333] dark:bg-[#1E1E1E]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  Lợi nhuận gộp ước tính
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-800 dark:bg-[#2A2A2A] dark:text-white">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {formatVND(summaryData?.grossProfit || 0)}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-neutral-300">
                  <span>Tỷ suất lợi nhuận: {summaryData?.profitMargin || 0}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Số lượng đơn hàng */}
            <Card className="border border-slate-200/80 bg-white/70 backdrop-blur-md dark:border-[#333333] dark:bg-[#1E1E1E]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  Tổng số đơn hàng
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Package className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {summaryData?.totalOrders || 0} <span className="text-sm font-normal text-slate-500">đơn</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                  <span>Giá trị TB/đơn: {formatVND(summaryData?.averageOrderValue || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Kênh bán hàng hàng đầu */}
            <Card className="border border-slate-200/80 bg-white/70 backdrop-blur-md dark:border-[#333333] dark:bg-[#1E1E1E]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  Kênh bán hiệu quả nhất
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {summaryData?.channelBreakdown?.[0]
                    ? CHANNEL_CONFIG[summaryData.channelBreakdown[0].channel]?.label || summaryData.channelBreakdown[0].channel
                    : "Chưa có dữ liệu"}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                  <span>
                    {summaryData?.channelBreakdown?.[0]
                      ? `${formatVND(summaryData.channelBreakdown[0].revenue)} (${summaryData.channelBreakdown[0].percentage}%)`
                      : "0 ₫"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Channel Proportion Breakdown Bar */}
          {summaryData?.channelBreakdown && summaryData.channelBreakdown.length > 0 && (
            <Card className="border border-slate-200/80 bg-white dark:border-[#333333] dark:bg-[#1E1E1E]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Phân bổ Doanh thu theo Kênh bán hàng</span>
                  <span className="text-xs font-normal text-slate-500">100% tỷ trọng doanh thu</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Visual stacked bar */}
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-[#2C2C2C] flex overflow-hidden">
                  {summaryData.channelBreakdown.map((item: any) => {
                    const config = CHANNEL_CONFIG[item.channel];
                    const widthPercent = Math.max(item.percentage, 2);
                    let barColor = "bg-slate-400";
                    if (item.channel === "SHOPEE") barColor = "bg-orange-500";
                    else if (item.channel === "TIKTOK_SHOP") barColor = "bg-zinc-800 dark:bg-zinc-200";
                    else if (item.channel === "POS_STORE") barColor = "bg-blue-600";
                    else if (item.channel === "FACEBOOK") barColor = "bg-sky-500";
                    else if (item.channel === "WEBSITE") barColor = "bg-emerald-500";
                    else if (item.channel === "LAZADA") barColor = "bg-indigo-500";

                    return (
                      <div
                        key={item.channel}
                        style={{ width: `${widthPercent}%` }}
                        className={cn(barColor, "h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full")}
                        title={`${config?.label || item.channel}: ${formatVND(item.revenue)} (${item.percentage}%)`}
                      />
                    );
                  })}
                </div>

                {/* Channel Badges List */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {summaryData.channelBreakdown.map((item: any) => {
                    const config = CHANNEL_CONFIG[item.channel];
                    const Icon = config?.icon || Layers;
                    return (
                      <div
                        key={item.channel}
                        onClick={() => setSelectedChannel(selectedChannel === item.channel ? "ALL" : item.channel)}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                          selectedChannel === item.channel
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20"
                            : "border-slate-200/80 hover:border-slate-300 dark:border-[#333333] dark:hover:border-[#444444]"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300 truncate">
                            {config?.label || item.channel}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                          {formatVND(item.revenue)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-neutral-400">
                          {item.count} đơn ({item.percentage}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Multi-Dimensional Filter Bar */}
      <Card className="border border-slate-200/80 bg-white dark:border-[#333333] dark:bg-[#1E1E1E]">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm mã đơn, tên khách, SĐT, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Filter by Channel */}
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-[#333333] dark:bg-[#252526] dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">Tất cả kênh bán</option>
              <option value="POS_STORE">Cửa hàng (POS)</option>
              <option value="SHOPEE">Shopee</option>
              <option value="TIKTOK_SHOP">TikTok Shop</option>
              <option value="LAZADA">Lazada</option>
              <option value="WEBSITE">Website</option>
              <option value="FACEBOOK">Facebook (Ship COD)</option>
              <option value="ZALO">Zalo (Ship COD)</option>
              <option value="MANUAL_OTHER">Kênh khác</option>
            </select>

            {/* Filter by Store */}
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-[#333333] dark:bg-[#252526] dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">Tất cả cửa hàng</option>
              {stores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Filter by Order Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-[#333333] dark:bg-[#252526] dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DELIVERED">Hoàn tất</option>
              <option value="SHIPPING">Đang giao</option>
              <option value="PROCESSING">Đang xử lý</option>
              <option value="PENDING">Chờ xác nhận</option>
              <option value="CANCELLED">Đã huỷ</option>
              <option value="RETURNED">Hoàn trả</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border border-slate-200/80 bg-white dark:border-[#333333] dark:bg-[#1E1E1E] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-[#333333] dark:bg-[#252526] dark:text-neutral-400">
              <tr>
                <th className="py-3 px-4">Mã đơn & Thời gian</th>
                <th className="py-3 px-4">Kênh bán</th>
                <th className="py-3 px-4">Cửa hàng</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Sản phẩm</th>
                <th className="py-3 px-4 text-right">Tổng thực thu</th>
                <th className="py-3 px-4 text-center">Thanh toán</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2C2C2C]">
              {ordersLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-800 dark:text-slate-200" />
                    Đang tải danh sách đơn hàng...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    <Package className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-neutral-600" />
                    <p className="font-semibold text-slate-700 dark:text-neutral-300">Chưa có đơn hàng nào trong khoảng thời gian này</p>
                    <p className="text-xs text-slate-400 mt-1">Hãy bấm "Lên đơn Bán hàng" để tạo đơn hàng đầu tiên.</p>
                  </td>
                </tr>
              ) : (
                orders.map((order: any) => {
                  const channelConf = CHANNEL_CONFIG[order.channel] || CHANNEL_CONFIG.MANUAL_OTHER;
                  const ChannelIcon = channelConf.icon;
                  const statusConf = ORDER_STATUS_CONFIG[order.orderStatus] || ORDER_STATUS_CONFIG.PENDING;
                  const paymentConf = PAYMENT_STATUS_CONFIG[order.paymentStatus] || PAYMENT_STATUS_CONFIG.UNPAID;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#252526] transition-colors cursor-pointer"
                      onClick={() => setSelectedOrderForDetail(order)}
                    >
                      {/* Mã đơn & Ngày */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{order.code}</span>
                          {order.externalOrderId && (
                            <span className="text-[10px] bg-slate-100 dark:bg-[#333333] px-1.5 py-0.5 rounded text-slate-500" title={`Mã sàn: ${order.externalOrderId}`}>
                              Sàn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                          {new Date(order.orderDate).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </div>
                      </td>

                      {/* Kênh bán */}
                      <td className="py-3.5 px-4">
                        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold", channelConf.bg, channelConf.text, channelConf.border)}>
                          <ChannelIcon className="h-3.5 w-3.5" />
                          <span>{channelConf.label}</span>
                        </div>
                      </td>

                      {/* Cửa hàng */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-neutral-300">
                        {order.store?.name || "Kênh Online / Chung"}
                      </td>

                      {/* Khách hàng */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-neutral-200">
                          {order.customerName || order.customer?.name || "Khách lẻ"}
                        </div>
                        {(order.customerPhone || order.customer?.phone) && (
                          <div className="text-[11px] text-slate-500 dark:text-neutral-400">
                            {order.customerPhone || order.customer?.phone}
                          </div>
                        )}
                      </td>

                      {/* Sản phẩm */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-800 dark:text-neutral-200 max-w-[200px] truncate">
                          {order.items?.length > 0 ? order.items[0].productName : "Chưa có SP"}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-neutral-400">
                          {order.items?.length > 1 ? `+ ${order.items.length - 1} sản phẩm khác` : `SL: ${order.items?.[0]?.quantity || 1}`}
                        </div>
                      </td>

                      {/* Tổng thực thu */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatVND(order.finalAmount)}
                        </div>
                        {order.discountAmount > 0 && (
                          <div className="text-[10px] text-rose-500">
                            Giảm: -{formatVND(order.discountAmount)}
                          </div>
                        )}
                      </td>

                      {/* Trạng thái thanh toán */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-semibold", paymentConf.color)}>
                          {paymentConf.label}
                        </span>
                      </td>

                      {/* Trạng thái đơn hàng */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-medium", statusConf.color)}>
                          <span>{statusConf.label}</span>
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOrderForDetail(order)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canDelete && order.orderStatus !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelOrder(order.id, order.code)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                              title="Huỷ đơn & hoàn tồn"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL 1: ORDER DETAIL & INVOICE */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1E1E1E] dark:border dark:border-[#333333] max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#333333]">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Hoá đơn: {selectedOrderForDetail.code}</span>
                  <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-semibold border", CHANNEL_CONFIG[selectedOrderForDetail.channel]?.bg, CHANNEL_CONFIG[selectedOrderForDetail.channel]?.text, CHANNEL_CONFIG[selectedOrderForDetail.channel]?.border)}>
                    {CHANNEL_CONFIG[selectedOrderForDetail.channel]?.label || selectedOrderForDetail.channel}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Thời gian đặt: {new Date(selectedOrderForDetail.orderDate).toLocaleString("vi-VN")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="h-8 gap-1 text-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>In hoá đơn</span>
                </Button>
                <button
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2C2C2C]"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Customer & Store Info Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#252526] text-xs">
                <div>
                  <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Khách hàng:</span>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {selectedOrderForDetail.customerName || selectedOrderForDetail.customer?.name || "Khách lẻ"}
                  </div>
                  {(selectedOrderForDetail.customerPhone || selectedOrderForDetail.customer?.phone) && (
                    <div className="text-slate-600 dark:text-neutral-300">
                      SĐT: {selectedOrderForDetail.customerPhone || selectedOrderForDetail.customer?.phone}
                    </div>
                  )}
                  {(selectedOrderForDetail.customerAddress || selectedOrderForDetail.customer?.address) && (
                    <div className="text-slate-600 dark:text-neutral-300 mt-0.5">
                      Đ/c: {selectedOrderForDetail.customerAddress || selectedOrderForDetail.customer?.address}
                    </div>
                  )}
                </div>

                <div>
                  <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Chi nhánh & Phụ trách:</span>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {selectedOrderForDetail.store?.name || "Kênh Online"}
                  </div>
                  {selectedOrderForDetail.employee && (
                    <div className="text-slate-600 dark:text-neutral-300">
                      Nhân viên: {selectedOrderForDetail.employee.name}
                    </div>
                  )}
                  <div className="text-slate-600 dark:text-neutral-300 mt-0.5">
                    Hình thức: {selectedOrderForDetail.paymentMethod}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-xl border border-slate-200 dark:border-[#333333] overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-[#2C2C2C] font-semibold text-slate-600 dark:text-neutral-300">
                    <tr>
                      <th className="py-2.5 px-3">Sản phẩm / SKU</th>
                      <th className="py-2.5 px-3 text-right">Đơn giá</th>
                      <th className="py-2.5 px-3 text-center">SL</th>
                      <th className="py-2.5 px-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2C2C2C]">
                    {selectedOrderForDetail.items?.map((it: any) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{it.productName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">SKU: {it.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">{formatVND(it.unitPrice)}</td>
                        <td className="py-2.5 px-3 text-center font-bold">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {formatVND(it.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Summary */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#252526] text-xs">
                <div className="flex justify-between text-slate-600 dark:text-neutral-400">
                  <span>Tổng tiền hàng:</span>
                  <span>{formatVND(selectedOrderForDetail.totalAmount)}</span>
                </div>
                {selectedOrderForDetail.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-500 font-medium">
                    <span>Chiết khấu / Giảm giá:</span>
                    <span>-{formatVND(selectedOrderForDetail.discountAmount)}</span>
                  </div>
                )}
                {selectedOrderForDetail.shippingFee > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-neutral-400">
                    <span>Phí vận chuyển:</span>
                    <span>+{formatVND(selectedOrderForDetail.shippingFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-[#333333]">
                  <span>Tổng thực thu:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatVND(selectedOrderForDetail.finalAmount)}</span>
                </div>
              </div>

              {selectedOrderForDetail.note && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs">
                  <span className="font-bold block mb-0.5">Ghi chú:</span>
                  {selectedOrderForDetail.note}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-[#333333] flex justify-end">
              <Button onClick={() => setSelectedOrderForDetail(null)} className="h-9 px-5">
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: E-COMMERCE CONNECTION CHANNELS */}
      {isEcommerceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1E1E1E] dark:border dark:border-[#333333]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#333333]">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-orange-500" />
                  <span>Kết nối Sàn Thương Mại Điện Tử</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đồng bộ đơn hàng tự động và cập nhật tồn kho 2 chiều thời gian thực.
                </p>
              </div>
              <button
                onClick={() => setIsEcommerceModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2C2C2C]"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              {/* Shopee Connection Card */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-orange-200/80 bg-orange-50/40 dark:bg-orange-950/20 dark:border-orange-900/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white font-bold">
                    S
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Shopee Open Platform</h4>
                    <p className="text-xs text-slate-500">Đồng bộ đơn hàng & Tồn kho SKU qua Webhook</p>
                  </div>
                </div>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                  Kết nối Shop
                </Button>
              </div>

              {/* TikTok Shop Connection Card */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-300 bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white font-bold">
                    TT
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">TikTok Shop Partner API</h4>
                    <p className="text-xs text-slate-500">Đồng bộ Livestream & Đơn đặt tự động</p>
                  </div>
                </div>
                <Button size="sm" className="bg-zinc-900 hover:bg-black text-white font-semibold dark:bg-zinc-700 dark:hover:bg-zinc-600">
                  Kết nối Shop
                </Button>
              </div>

              {/* Lazada Connection Card */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-900/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">
                    L
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Lazada Open Platform</h4>
                    <p className="text-xs text-slate-500">Đồng bộ gian hàng LazMall / Standard</p>
                  </div>
                </div>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  Kết nối Shop
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-[#333333] flex justify-end">
              <Button onClick={() => setIsEcommerceModalOpen(false)} variant="outline" className="h-9 px-5">
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
