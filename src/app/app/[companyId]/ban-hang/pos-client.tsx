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
  TrendingUp,
  Store as StoreIcon,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Truck,
  RotateCcw,
  Package,
  Layers,
  ArrowLeft,
  Smartphone,
  Share2,
  Tag,
  Percent,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function PosClient({
  companyId,
  userRole,
  canEdit,
}: {
  companyId: string;
  userRole: string;
  canEdit: boolean;
}) {
  const { notify } = useNotifications();

  // Data fetching
  const { data: productsData, isLoading: productsLoading, mutate: mutateProducts } = useSWR<{ products: any[] }>(
    `/api/products?limit=300`,
    fetcher
  );
  const { data: stores } = useSWR<any[]>("/api/stores", fetcher);
  const { data: employees } = useSWR<any[]>("/api/employees", fetcher);

  const products = productsData?.products || [];

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
    <div className="space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-[#333333]">
        <div className="flex items-center gap-3">
          <Link href={`/app/${companyId}/doanh-thu`}>
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-neutral-400">
              <ArrowLeft className="h-4 w-4" />
              <span>Xem Doanh thu</span>
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-300 dark:bg-[#333333]" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-slate-900 dark:text-white" />
            Bán hàng & Lên đơn Đa kênh
          </h1>
        </div>

        {/* Store & Staff Quick Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#252526] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#333333]">
            <StoreIcon className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 dark:text-white focus:outline-none"
            >
              {stores?.map((s) => (
                <option key={s.id} value={s.id} className="dark:bg-[#1E1E1E]">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#252526] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#333333]">
            <User className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="bg-transparent font-medium text-slate-800 dark:text-white focus:outline-none"
            >
              <option value="" className="dark:bg-[#1E1E1E]">
                Nhân viên bán hàng...
              </option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id} className="dark:bg-[#1E1E1E]">
                  {emp.name} ({emp.position})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* POS Main Grid: Left Products Catalog (60%), Right Cart & Checkout (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: PRODUCTS CATALOG */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Search and Category Filter Toolbar */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm sản phẩm theo Tên, Mã SKU hoặc quét Barcode EAN-8..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-sm rounded-xl bg-white dark:bg-[#1E1E1E] border-slate-200 dark:border-[#333333] shadow-sm"
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
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#252526] dark:text-neutral-400"
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
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#252526] dark:text-neutral-400"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {productsLoading ? (
              <div className="col-span-3 py-16 text-center text-slate-400">
                Đang tải danh mục sản phẩm...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-3 py-16 text-center text-slate-400">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-slate-700 dark:text-neutral-300">Không tìm thấy sản phẩm phù hợp</p>
                <p className="text-xs text-slate-400 mt-0.5">Thử nhập từ khoá khác hoặc tạo sản phẩm mới trong tab Hàng hoá.</p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isOutOfStock = (p.stockQuantity || 0) <= 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-2xl border bg-white p-3 shadow-sm transition-all duration-200 cursor-pointer select-none",
                      "hover:border-indigo-400 hover:shadow-md dark:bg-[#1E1E1E] dark:border-[#333333] dark:hover:border-indigo-500",
                      isOutOfStock && "opacity-60 bg-slate-50/50"
                    )}
                  >
                    <div>
                      {/* Product Image / Placeholder */}
                      <div className="relative mb-2.5 h-28 w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-[#2A2A2A] flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <Package className="h-8 w-8 text-slate-300 dark:text-neutral-600" />
                        )}
                        {/* Stock Badge */}
                        <div className="absolute top-2 right-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm",
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

                      {/* Product Info */}
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {p.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-1">
                        <span>{p.sku}</span>
                        {(p.colorName || p.sizeName) && (
                          <span className="text-[10px] bg-slate-100 dark:bg-[#2C2C2C] px-1 py-0.2 rounded font-sans text-slate-600 dark:text-neutral-300">
                            {[p.colorName, p.sizeName].filter(Boolean).join(" / ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price & Add Button */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-[#2C2C2C]">
                      <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                        {formatVND(p.sellingPrice || 0)}
                      </span>
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors dark:bg-[#2A2A2A] dark:text-neutral-300">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CART & CHECKOUT PANEL */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-lg dark:border-[#333333] dark:bg-[#1E1E1E] space-y-4">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#333333]">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-slate-900 dark:text-white" />
              <h3 className="font-bold text-slate-900 dark:text-white">Giỏ hàng ({cart.reduce((s, i) => s + i.quantity, 0)})</h3>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearCart} className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1.5">
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Xoá giỏ
              </Button>
            )}
          </div>

          {/* Sales Channel Selector */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Kênh bán hàng:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { key: "POS_STORE", label: "Tại quầy (POS)", icon: StoreIcon },
                { key: "SHOPEE", label: "Shopee", icon: ShoppingCart },
                { key: "TIKTOK_SHOP", label: "TikTok Shop", icon: Smartphone },
                { key: "FACEBOOK", label: "Facebook / COD", icon: Share2 },
                { key: "ZALO", label: "Zalo / COD", icon: Share2 },
                { key: "WEBSITE", label: "Website", icon: Globe },
              ].map((ch) => {
                const Icon = ch.icon;
                return (
                  <button
                    key={ch.key}
                    onClick={() => setSelectedChannel(ch.key)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all text-center select-none",
                      selectedChannel === ch.key
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#333333] dark:text-neutral-400"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer & Shipping Details (Visible especially for Facebook / Zalo / Website / Delivery) */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-[#252526] border border-slate-200/60 dark:border-[#333333]">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-neutral-300">
              <span>Thông tin Khách hàng & Giao hàng</span>
              <span className="text-[10px] font-normal text-slate-400">Tuỳ chọn</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Tên khách hàng"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-[#1E1E1E]"
              />
              <Input
                placeholder="Số điện thoại"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-[#1E1E1E]"
              />
            </div>
            {selectedChannel !== "POS_STORE" && (
              <Input
                placeholder="Địa chỉ giao hàng chi tiết (Nhà, đường, phường, quận...)"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-[#1E1E1E]"
              />
            )}
          </div>

          {/* Cart Items List */}
          <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-100 dark:divide-[#2A2A2A] pr-1">
            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Chưa có sản phẩm trong giỏ hàng. Hãy bấm vào sản phẩm bên trái để thêm.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</h5>
                    <div className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
                      {item.sku} • {formatVND(item.unitPrice)}
                    </div>
                  </div>

                  {/* Quantity Counter */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#2A2A2A] p-1 rounded-lg">
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, -1)}
                      className="h-6 w-6 rounded bg-white dark:bg-[#333333] flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-200"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, 1)}
                      className="h-6 w-6 rounded bg-white dark:bg-[#333333] flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-200"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="text-right min-w-[75px]">
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

          {/* Payment Method Selector */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#333333]">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Hình thức thanh toán:</span>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { key: "CASH", label: "Tiền mặt", icon: Banknote },
                { key: "BANK_TRANSFER", label: "Chuyển khoản QR", icon: QrCode },
                { key: "CREDIT_CARD", label: "Thẻ", icon: CreditCard },
                { key: "COD", label: "Thu hộ COD", icon: Truck },
              ].map((pm) => {
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.key}
                    onClick={() => setPaymentMethod(pm.key)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl border text-[11px] font-semibold transition-all select-none",
                      paymentMethod === pm.key
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#333333] dark:text-neutral-400"
                    )}
                  >
                    <Icon className="h-4 w-4 mb-1" />
                    <span>{pm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discount & Shipping inputs */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block mb-1">Giảm giá (₫):</span>
              <Input
                type="number"
                min="0"
                value={discountAmount || ""}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                placeholder="0 ₫"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Phí vận chuyển (₫):</span>
              <Input
                type="number"
                min="0"
                value={shippingFee || ""}
                onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                placeholder="0 ₫"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Financial Calculation Box */}
          <div className="space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-xs dark:bg-[#252526]">
            <div className="flex justify-between text-slate-600 dark:text-neutral-400">
              <span>Tạm tính tiền hàng:</span>
              <span className="font-semibold text-slate-800 dark:text-neutral-200">{formatVND(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-500">
                <span>Chiết khấu:</span>
                <span>-{formatVND(discountAmount)}</span>
              </div>
            )}
            {shippingFee > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-neutral-400">
                <span>Phí giao hàng:</span>
                <span>+{formatVND(shippingFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-[#333333]">
              <span>Khách phải trả:</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatVND(totalFinal)}</span>
            </div>
          </div>

          {/* Cash Tender Calculation (If cash selected) */}
          {paymentMethod === "CASH" && (
            <div className="space-y-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/50 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-300">Tiền khách đưa:</span>
                <Input
                  type="number"
                  value={cashGiven || ""}
                  onChange={(e) => setCashGiven(Number(e.target.value) || 0)}
                  placeholder="Nhập số tiền..."
                  className="w-36 h-7 text-right text-xs font-bold bg-white dark:bg-[#1E1E1E]"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {[totalFinal, 50000, 100000, 200000, 500000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashGiven(amt)}
                    className="px-2 py-0.5 rounded bg-white text-[10px] font-bold border border-amber-300 text-amber-900 hover:bg-amber-100 dark:bg-[#2C2C2C] dark:text-amber-300 dark:border-amber-800"
                  >
                    {amt === totalFinal ? "Đủ tiền" : formatVND(amt)}
                  </button>
                ))}
              </div>
              {cashGiven > 0 && (
                <div className="flex justify-between font-bold text-amber-900 dark:text-amber-300 pt-1 border-t border-amber-200/60">
                  <span>Tiền thối lại:</span>
                  <span className="text-sm text-emerald-700 dark:text-emerald-400 font-extrabold">{formatVND(changeReturn)}</span>
                </div>
              )}
            </div>
          )}

          {/* Order Note */}
          <Input
            placeholder="Ghi chú đơn hàng..."
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            className="h-8 text-xs"
          />

          {/* Big Checkout CTA Button */}
          <Button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSubmitting || !canEdit}
            className="w-full h-12 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-xl transition-all"
          >
            {isSubmitting ? (
              "Đang xử lý đơn hàng..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Thanh toán {formatVND(totalFinal)} & Trừ Tồn Kho
              </>
            )}
          </Button>
        </div>
      </div>

      {/* MODAL: ORDER SUCCESS & RECEIPT PRINT */}
      {completedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1E1E1E] dark:border dark:border-[#333333] space-y-4">
            <div className="text-center space-y-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tạo đơn hàng thành công!</h3>
              <p className="text-xs text-slate-500 font-mono">Mã đơn: {completedOrder.code}</p>
            </div>

            {/* Receipt Box */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-[#333333] bg-slate-50 dark:bg-[#252526] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-semibold text-slate-800 dark:text-neutral-200">{completedOrder.customerName || "Khách lẻ"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kênh bán:</span>
                <span className="font-semibold text-slate-800 dark:text-neutral-200">{completedOrder.channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số lượng SP:</span>
                <span className="font-semibold text-slate-800 dark:text-neutral-200">{completedOrder.items?.length || 1} mặt hàng</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-[#333333]">
                <span>Tổng thực thu:</span>
                <span className="text-emerald-600 text-sm">{formatVND(completedOrder.finalAmount)}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="h-9 gap-1.5 text-xs"
              >
                <Printer className="h-4 w-4" />
                <span>In hoá đơn</span>
              </Button>
              <Button
                onClick={() => setCompletedOrder(null)}
                className="h-9 px-5 text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
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
