"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  Store as StoreIcon,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Truck,
  RotateCcw,
  Package,
  Layers,
  Smartphone,
  Share2,
  Globe,
  LayoutDashboard,
  ExternalLink,
  Clock,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useNotifications } from "@/components/notifications/notification-center";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

type CartItem = {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discount: number;
  imageUrl?: string | null;
  stockQuantity: number;
  colorName?: string | null;
  sizeName?: string | null;
};

export function PosFullscreenClient({
  companyId,
  companyName,
  userRole,
  canEdit,
}: {
  companyId: string;
  companyName: string;
  userRole: string;
  canEdit: boolean;
}) {
  const { notify } = useNotifications();

  // Data fetching
  const { data: productsData, isLoading: productsLoading, mutate: mutateProducts } = useSWR<{ products: any[] }>(
    `/api/products?limit=500`,
    fetcher
  );
  const { data: rawStores } = useSWR<any[]>("/api/stores", fetcher);
  const { data: rawEmployees } = useSWR<any[]>("/api/employees", fetcher);

  const products = Array.isArray(productsData?.products) ? productsData.products : [];
  const stores = Array.isArray(rawStores) ? rawStores : [];
  const employees = Array.isArray(rawEmployees) ? rawEmployees : [];

  // Live time state
  const [currentTime, setCurrentTime] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
          " - " +
          now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("POS_STORE");

  // Customer & Shipping for Social/COD
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [orderNote, setOrderNote] = useState<string>("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Checkout Success Modal
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default store when loaded
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "ALL" && p.category?.name !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchSku = p.sku?.toLowerCase().includes(q);
        const matchBarcode = p.barcode?.includes(q);
        return matchName || matchSku || matchBarcode;
      }
      return true;
    });
  }, [products, searchQuery, selectedCategory]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.name) set.add(p.category.name);
    });
    return Array.from(set);
  }, [products]);

  // Add to cart
  const handleAddToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPrice: product.sellingPrice || 0,
          costPrice: product.costPrice || 0,
          quantity: 1,
          discount: 0,
          imageUrl: product.imageUrl,
          stockQuantity: product.stockQuantity || 0,
          colorName: product.colorName,
          sizeName: product.sizeName,
        },
      ];
    });
  };

  // Update quantity
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Remove from cart
  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Clear cart
  const handleClearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setShippingFee(0);
    setCashGiven(0);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderNote("");
  };

  // Financial calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);
  }, [cart]);

  const totalFinal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + shippingFee);
  }, [subtotal, discountAmount, shippingFee]);

  const changeReturn = useMemo(() => {
    if (paymentMethod !== "CASH" || cashGiven <= 0) return 0;
    return Math.max(0, cashGiven - totalFinal);
  }, [paymentMethod, cashGiven, totalFinal]);

  // Submit Order
  const handleCheckout = async () => {
    if (!canEdit) {
      notify({ title: "Từ chối", body: "Bạn không có quyền tạo đơn hàng", tone: "error" });
      return;
    }
    if (cart.length === 0) {
      notify({ title: "Lỗi", body: "Vui lòng chọn ít nhất 1 sản phẩm vào giỏ hàng", tone: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        channel: selectedChannel,
        storeId: selectedStoreId || null,
        employeeId: selectedEmployeeId || null,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        customerAddress: customerAddress.trim() || null,
        discountAmount,
        shippingFee,
        paymentMethod,
        paymentStatus: selectedChannel === "POS_STORE" || paymentMethod !== "COD" ? "PAID" : "UNPAID",
        orderStatus: selectedChannel === "POS_STORE" ? "DELIVERED" : "SHIPPING",
        note: orderNote.trim() || null,
        items: cart.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          productName: item.name,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          quantity: item.quantity,
          discount: item.discount,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không hoàn tất được đơn hàng");

      notify({
        title: "Thành công",
        body: `Đã tạo đơn hàng ${data.order?.code} và tự động trừ tồn kho!`,
        tone: "success",
      });

      setCompletedOrder(data.order);
      handleClearCart();
      mutateProducts();
    } catch (err: any) {
      notify({
        title: "Lỗi tạo đơn",
        body: err.message,
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-[#18181B] text-slate-900 dark:text-white">
      {/* 1. STANDALONE TOP NAVIGATION BAR (NO SIDEBAR) */}
      <header className="h-14 px-4 bg-white dark:bg-[#1F1F23] border-b border-slate-200/80 dark:border-[#2E2E33] flex items-center justify-between shadow-sm shrink-0">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-bold">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                {companyName || "ApexFlow"} POS
              </span>
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                Thu ngân & Bán hàng
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
              {currentTime}
            </p>
          </div>
        </div>

        {/* Center: Store & Cashier Selector */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#2A2A2E] px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#3A3A40]">
            <StoreIcon className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-400">Chi nhánh:</span>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer"
            >
              {stores?.map((s) => (
                <option key={s.id} value={s.id} className="dark:bg-[#1E1E1E]">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#2A2A2E] px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#3A3A40]">
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-slate-400">Thu ngân:</span>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="bg-transparent font-medium text-slate-800 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="" className="dark:bg-[#1E1E1E]">
                Chọn nhân viên...
              </option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id} className="dark:bg-[#1E1E1E]">
                  {emp.name} ({emp.position})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Actions & Return to Management Link */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          <Link href={`/app/${companyId}/don-hang`}>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold border-slate-300 dark:border-[#3A3A40] bg-white hover:bg-slate-50 dark:bg-[#2A2A2E] dark:hover:bg-[#333338]"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Trang Quản Lý</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* 2. POS BODY: LEFT CATALOG (60%) & RIGHT CART/CHECKOUT (40%) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* LEFT COLUMN: PRODUCTS CATALOG */}
        <div className="lg:col-span-7 flex flex-col h-full bg-white dark:bg-[#1F1F23] rounded-2xl border border-slate-200/80 dark:border-[#2E2E33] p-3 overflow-hidden shadow-sm">
          {/* Search Bar & Categories */}
          <div className="space-y-2 pb-3 border-b border-slate-100 dark:border-[#2E2E33] shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm sản phẩm theo Tên, Mã SKU hoặc quét Barcode EAN-8..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-sm rounded-xl bg-slate-50 dark:bg-[#2A2A2E] border-slate-200 dark:border-[#3A3A40]"
                autoFocus
              />
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none",
                  selectedCategory === "ALL"
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#2A2A2E] dark:text-neutral-400"
                )}
              >
                Tất cả ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none",
                    selectedCategory === cat
                      ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#2A2A2E] dark:text-neutral-400"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid - Scrollable */}
          <div className="flex-1 overflow-y-auto pt-3 pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {productsLoading ? (
              <div className="col-span-4 py-20 text-center text-slate-400 text-xs">
                Đang tải danh mục hàng hoá...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-4 py-20 text-center text-slate-400">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-xs text-slate-700 dark:text-neutral-300">Không tìm thấy sản phẩm</p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isOutOfStock = (p.stockQuantity || 0) <= 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-xl border p-2.5 shadow-sm transition-all duration-150 cursor-pointer select-none",
                      "bg-white hover:border-indigo-500 hover:shadow-md dark:bg-[#26262B] dark:border-[#333338] dark:hover:border-indigo-400",
                      isOutOfStock && "opacity-60 bg-slate-50/50"
                    )}
                  >
                    <div>
                      {/* Product Image / Placeholder */}
                      <div className="relative mb-2 h-24 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-[#1E1E22] flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        ) : (
                          <Package className="h-6 w-6 text-slate-300 dark:text-neutral-600" />
                        )}
                        {/* Stock Badge */}
                        <div className="absolute top-1.5 right-1.5">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm",
                              isOutOfStock
                                ? "bg-rose-500 text-white"
                                : (p.stockQuantity || 0) <= 5
                                ? "bg-amber-500 text-white"
                                : "bg-slate-900/80 text-white backdrop-blur-md dark:bg-white/90 dark:text-slate-900"
                            )}
                          >
                            Tồn: {p.stockQuantity || 0}
                          </span>
                        </div>
                      </div>

                      {/* Product Name */}
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight">
                        {p.name}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>{p.sku}</span>
                        {(p.colorName || p.sizeName) && (
                          <span className="bg-slate-100 dark:bg-[#333338] px-1 py-0.2 rounded font-sans text-slate-600 dark:text-neutral-300">
                            {[p.colorName, p.sizeName].filter(Boolean).join(" / ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price & Add */}
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-[#333338]">
                      <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                        {formatVND(p.sellingPrice || 0)}
                      </span>
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors dark:bg-[#333338] dark:text-neutral-300">
                        <Plus className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE CART & CHECKOUT PANEL */}
        <div className="lg:col-span-5 flex flex-col h-full bg-white dark:bg-[#1F1F23] rounded-2xl border border-slate-200/80 dark:border-[#2E2E33] p-3.5 shadow-sm overflow-hidden">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2E2E33] shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-slate-900 dark:text-white" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Giỏ hàng ({cart.reduce((s, i) => s + i.quantity, 0)})
              </h3>
            </div>
            {cart.length > 0 && (
              <button onClick={handleClearCart} className="text-[11px] text-rose-500 hover:underline flex items-center gap-1">
                <RotateCcw className="h-3 w-3" />
                <span>Xoá tất cả</span>
              </button>
            )}
          </div>

          {/* Sales Channel Selector */}
          <div className="pt-2 pb-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Kênh bán:</span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { key: "POS_STORE", label: "Tại quầy", icon: StoreIcon },
                { key: "SHOPEE", label: "Shopee", icon: ShoppingCart },
                { key: "TIKTOK_SHOP", label: "TikTok", icon: Smartphone },
                { key: "FACEBOOK", label: "FB / COD", icon: Share2 },
                { key: "ZALO", label: "Zalo / COD", icon: Share2 },
                { key: "WEBSITE", label: "Web", icon: Globe },
              ].map((ch) => {
                const Icon = ch.icon;
                return (
                  <button
                    key={ch.key}
                    onClick={() => setSelectedChannel(ch.key)}
                    className={cn(
                      "flex items-center justify-center gap-1 p-1.5 rounded-lg border text-[11px] font-semibold transition-all select-none",
                      selectedChannel === ch.key
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#333338] dark:text-neutral-400"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="truncate">{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer CRM Input */}
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#26262B] border border-slate-200/60 dark:border-[#333338] space-y-1.5 shrink-0">
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                placeholder="Tên khách hàng"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-7 text-xs bg-white dark:bg-[#1F1F23]"
              />
              <Input
                placeholder="Số điện thoại"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="h-7 text-xs bg-white dark:bg-[#1F1F23]"
              />
            </div>
            {selectedChannel !== "POS_STORE" && (
              <Input
                placeholder="Địa chỉ giao hàng chi tiết..."
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="h-7 text-xs bg-white dark:bg-[#1F1F23]"
              />
            )}
          </div>

          {/* Cart Items List - Scrollable */}
          <div className="flex-1 overflow-y-auto py-2 space-y-1.5 divide-y divide-slate-100 dark:divide-[#2E2E33] pr-1">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Chưa có sản phẩm. Click vào sản phẩm bên trái để thêm.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</h5>
                    <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                      {item.sku} • {formatVND(item.unitPrice)}
                    </div>
                  </div>

                  {/* Quantity Counter */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#26262B] p-0.5 rounded-lg">
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, -1)}
                      className="h-5 w-5 rounded bg-white dark:bg-[#333338] flex items-center justify-center text-slate-700 dark:text-white"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, 1)}
                      className="h-5 w-5 rounded bg-white dark:bg-[#333338] flex items-center justify-center text-slate-700 dark:text-white"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="text-right min-w-[70px]">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {formatVND(item.unitPrice * item.quantity - item.discount)}
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.productId)}
                      className="text-[10px] text-rose-500 hover:underline"
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment & Checkout Section - Bottom fixed */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#2E2E33] space-y-2 shrink-0">
            {/* Payment Method */}
            <div className="grid grid-cols-4 gap-1">
              {[
                { key: "CASH", label: "Tiền mặt", icon: Banknote },
                { key: "BANK_TRANSFER", label: "QR Chuyển khoản", icon: QrCode },
                { key: "CREDIT_CARD", label: "Thẻ", icon: CreditCard },
                { key: "COD", label: "Thu hộ COD", icon: Truck },
              ].map((pm) => {
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.key}
                    onClick={() => setPaymentMethod(pm.key)}
                    className={cn(
                      "flex flex-col items-center justify-center p-1.5 rounded-lg border text-[10px] font-semibold transition-all select-none",
                      paymentMethod === pm.key
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#333338] dark:text-neutral-400"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 mb-0.5" />
                    <span>{pm.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Discount & Shipping */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#26262B] px-2 py-1 rounded-lg border border-slate-200 dark:border-[#333338]">
                <span className="text-[10px] text-slate-400 shrink-0">Giảm:</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  placeholder="0 ₫"
                  className="w-full bg-transparent text-right text-xs font-bold focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#26262B] px-2 py-1 rounded-lg border border-slate-200 dark:border-[#333338]">
                <span className="text-[10px] text-slate-400 shrink-0">Ship:</span>
                <input
                  type="number"
                  min="0"
                  value={shippingFee || ""}
                  onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                  placeholder="0 ₫"
                  className="w-full bg-transparent text-right text-xs font-bold focus:outline-none"
                />
              </div>
            </div>

            {/* Cash Tender Calculation */}
            {paymentMethod === "CASH" && (
              <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/50 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-amber-900 dark:text-amber-300">Khách đưa:</span>
                  <input
                    type="number"
                    value={cashGiven || ""}
                    onChange={(e) => setCashGiven(Number(e.target.value) || 0)}
                    placeholder="Số tiền..."
                    className="w-28 h-6 text-right text-xs font-bold bg-white dark:bg-[#1F1F23] rounded px-1.5 border border-amber-300 dark:border-amber-800 focus:outline-none"
                  />
                </div>
                {cashGiven > 0 && (
                  <div className="flex justify-between font-bold text-amber-900 dark:text-amber-300 pt-0.5 border-t border-amber-200/60">
                    <span>Thối lại:</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{formatVND(changeReturn)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Totals & Checkout Button */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Tổng thanh toán</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {formatVND(totalFinal)}
                </span>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={cart.length === 0 || isSubmitting || !canEdit}
                className="h-11 px-6 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-xl transition-all"
              >
                {isSubmitting ? (
                  "Đang xử lý..."
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Thanh toán & Trừ Tồn Kho
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ORDER SUCCESS & RECEIPT PRINT */}
      {completedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1F1F23] dark:border dark:border-[#2E2E33] space-y-4">
            <div className="text-center space-y-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Tạo đơn hàng thành công!</h3>
              <p className="text-xs text-slate-500 font-mono">Mã hoá đơn: {completedOrder.code}</p>
            </div>

            {/* Receipt Box */}
            <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-[#3A3A40] bg-slate-50 dark:bg-[#26262B] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-semibold text-slate-800 dark:text-neutral-200">{completedOrder.customerName || "Khách lẻ"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kênh bán:</span>
                <span className="font-semibold text-slate-800 dark:text-neutral-200">{completedOrder.channel}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-[#3A3A40]">
                <span>Tổng thực thu:</span>
                <span className="text-emerald-600 font-extrabold">{formatVND(completedOrder.finalAmount)}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="h-8 gap-1.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>In hoá đơn</span>
              </Button>
              <Button
                onClick={() => setCompletedOrder(null)}
                className="h-8 px-4 text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Tiếp tục bán hàng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
