"use client";

import React, { useState, useMemo, Fragment, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/components/notifications/notification-center";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import {
  Package,
  Plus,
  Search,
  Download,
  Barcode,
  Factory,
  Building2,
  Tag,
  Trash2,
  Edit,
  X,
  Check,
  Printer,
  Sparkles,
  FileSpreadsheet,
  Upload,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  ClipboardCheck,
  Truck,
  Eye,
  Info,
  Sliders,
  CheckCircle2,
  Layers,
  SearchCode,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  QrCode,
  FileText,
  Calendar,
  Pencil,
  AlertTriangle,
  Warehouse,
  FileCheck,
  Camera,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductTagPrintModal } from "@/components/products/product-tag-modal";
import { BatchLabelPrintModal } from "@/components/products/batch-label-modal";
import {
  generateSku,
  generateEan8Barcode,
  getColorCode,
  getSizeCode,
  stringToUniqueLetter,
  generateRandomNumericCode,
  getRandomCapitalLetter,
  getUniqueItemCode,
} from "@/lib/sku-engine";

type Category = {
  id: string;
  name: string;
  codeLetter: string;
  subcategories?: Subcategory[];
};

type Subcategory = {
  id: string;
  name: string;
  codeLetter: string;
  categoryId: string;
};

type Manufacturer = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  country?: string | null;
  taxId?: string | null;
};

type FactoryOrderItem = {
  id: string;
  productId?: string;
  productName: string;
  sku: string;
  colorName?: string | null;
  sizeName?: string | null;
  orderQuantity: number;
  qcPassedQuantity?: number;
  qcFailedQuantity?: number;
};

type FactoryOrder = {
  id: string;
  code: string; // PO / Batch Code e.g. BATCH-20260807-001
  batchCode: string;
  manufacturerId?: string;
  manufacturerName: string;
  productId?: string;
  productName: string;
  sku?: string;
  colorName?: string | null;
  sizeName?: string | null;
  orderQuantity: number;
  qcPassedQuantity: number;
  qcFailedQuantity: number;
  orderDate: string;
  expectedDate: string;
  receivedDate?: string;
  qcNotes?: string;
  failReasonNotes?: string; // Ghi chú lỗi chi tiết cho NSX
  status: "PENDING" | "IN_PRODUCTION" | "QC_INSPECTION" | "COMPLETED" | "PARTIAL_RETURN";
  batchLabelsPrinted?: boolean;
  items?: FactoryOrderItem[];
};

type Product = {
  id: string;
  name: string;
  brandName?: string | null;
  brandCode?: string | null;
  itemCode: string;
  colorName?: string | null;
  colorCode?: string | null;
  sizeName?: string | null;
  sizeCode?: string | null;
  sku: string;
  barcode: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  quantity?: number;
  imageUrl?: string | null;
  description?: string | null;
  isArchived: boolean;
  barcodeNeedsReprint?: boolean;
  category: { id: string; name: string; codeLetter: string };
  subcategory: { id: string; name: string; codeLetter: string };
  manufacturer?: { id: string; name: string; code: string; country?: string | null; phone?: string | null; address?: string | null } | null;
};

type ProductsData = {
  products: Product[];
  categories: Category[];
  manufacturers: Manufacturer[];
};

type BatchLabelConfig = {
  widthMm: number; // default 35 (3.5cm)
  heightMm: number; // default 25 (2.5cm)
  showSku: boolean;
  showBatchCode: boolean;
  showOrderDate: boolean;
  showReceivedDate: boolean;
  showManufacturer: boolean;
  printQuantity: number;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
};

const DEFAULT_FACTORY_ORDERS: FactoryOrder[] = [
  {
    id: "po-1",
    code: "PO-2026-001",
    batchCode: "Y34",
    manufacturerName: "Xưởng may Thanh Nam",
    productName: "Áo Thun Dakblancy Red",
    sku: "AB016904",
    orderQuantity: 500,
    qcPassedQuantity: 492,
    qcFailedQuantity: 8,
    orderDate: "2026-07-20",
    expectedDate: "2026-08-05",
    receivedDate: "2026-08-06",
    qcNotes: "Kiểm tra đường may kẹp nách, nhãn mác đính đúng vị trí",
    failReasonNotes: "8 áo bị lỗi chỉ khâu nách và dơ vết hồ nhuộm. Đã gửi trả xưởng may lại.",
    status: "PARTIAL_RETURN",
    batchLabelsPrinted: true,
    items: [
      { id: "item-1-1", productName: "Dakblancy RED", sku: "AA010302", colorName: "Đỏ", sizeName: "S", orderQuantity: 150, qcPassedQuantity: 148, qcFailedQuantity: 2 },
      { id: "item-1-2", productName: "Dakblancy RED", sku: "AA010102", colorName: "Trắng", sizeName: "S", orderQuantity: 150, qcPassedQuantity: 147, qcFailedQuantity: 3 },
      { id: "item-1-3", productName: "Dakblancy RED", sku: "AA010202", colorName: "Đen", sizeName: "S", orderQuantity: 200, qcPassedQuantity: 197, qcFailedQuantity: 3 },
    ],
  },
  {
    id: "po-2",
    code: "PO-2026-002",
    batchCode: "B01",
    manufacturerName: "Xưởng dệt Kim Long",
    productName: "Jacket Dak Denim (2 biến thể)",
    sku: "AB016904",
    orderQuantity: 300,
    qcPassedQuantity: 0,
    qcFailedQuantity: 0,
    orderDate: "2026-07-28",
    expectedDate: "2026-08-04", // Overdue example
    qcNotes: "May bo gấu và kéo khóa kim loại đồng màu",
    status: "IN_PRODUCTION",
    batchLabelsPrinted: true,
    items: [
      { id: "item-2-1", productName: "Jacket Dak", sku: "AB016904", colorName: "Denim Xanh", sizeName: "L", orderQuantity: 150, qcPassedQuantity: 0, qcFailedQuantity: 0 },
      { id: "item-2-2", productName: "Jacket Dak", sku: "AB016903", colorName: "Denim Xanh", sizeName: "M", orderQuantity: 150, qcPassedQuantity: 0, qcFailedQuantity: 0 },
    ],
  },
  {
    id: "po-3",
    code: "PO-2026-003",
    batchCode: "C03",
    manufacturerName: "Xưởng may Phong Phú",
    productName: "Quần Jean Slfit Black",
    sku: "AC020401",
    orderQuantity: 200,
    qcPassedQuantity: 200,
    qcFailedQuantity: 0,
    orderDate: "2026-07-10",
    expectedDate: "2026-07-25",
    receivedDate: "2026-07-24",
    qcNotes: "Vải đùn co giãn 4 chiều, đóng nút kim loại chắc chắn",
    status: "COMPLETED",
    batchLabelsPrinted: true,
    items: [
      { id: "item-3-1", productName: "Quần Jean Slfit Black", sku: "AC020401", colorName: "Đen", sizeName: "L", orderQuantity: 200, qcPassedQuantity: 200, qcFailedQuantity: 0 },
    ],
  },
];

export function ProductsClient({
  companyId,
  userRole,
  canEdit,
}: {
  companyId: string;
  userRole: string;
  canEdit: boolean;
}) {
  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();

  const { data, mutate, isLoading } = useSWR<ProductsData>(`/api/products`, fetcher);

  const initialProducts = data?.products ?? [];
  const categories = data?.categories ?? [];
  const manufacturers = data?.manufacturers ?? [];

  // Local state for stock quantities override (for live updates on QC completion)
  const [localStockOverrides, setLocalStockOverrides] = useState<Record<string, number>>({});

  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as "import" | "products" | "inventory" | null;

  // 3 Sub-tabs Navigation: "import" (Nhập hàng) | "products" (Sản phẩm) | "inventory" (Tồn kho)
  const [activeSubTab, setActiveSubTab] = useState<"import" | "products" | "inventory">(
    tabParam && ["import", "products", "inventory"].includes(tabParam) ? tabParam : "products"
  );

  useEffect(() => {
    if (tabParam && ["import", "products", "inventory"].includes(tabParam)) {
      setActiveSubTab(tabParam);
    }
  }, [tabParam]);

  const handleSubTabChange = (tab: "import" | "products" | "inventory") => {
    setActiveSubTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // Tab 1: Nhập hàng (Đặt hàng xưởng & QC) Data loaded from Database API
  const { data: poData, mutate: mutatePos, isLoading: isPoLoading } = useSWR<{ orders: FactoryOrder[] }>(
    `/api/factory-orders`,
    fetcher
  );

  const factoryOrders = useMemo(() => poData?.orders ?? [], [poData]);


  const products = useMemo(() => {
    return initialProducts.map((p) => {
      let qcPassedTotal = 0;
      for (const o of factoryOrders) {
        if (o.status === "COMPLETED" || o.status === "PARTIAL_RETURN") {
          if (o.items && o.items.length > 0) {
            for (const item of o.items) {
              let isMatch = false;
              if (p.sku && item.sku) {
                isMatch = item.sku.trim().toLowerCase() === p.sku.trim().toLowerCase();
              } else if (item.productName && p.name) {
                const nameMatch = item.productName.trim().toLowerCase() === p.name.trim().toLowerCase();
                const colorMatch = !item.colorName || !p.colorName || item.colorName.trim().toLowerCase() === p.colorName.trim().toLowerCase();
                const sizeMatch = !item.sizeName || !p.sizeName || item.sizeName.trim().toLowerCase() === p.sizeName.trim().toLowerCase();
                isMatch = nameMatch && colorMatch && sizeMatch;
              }
              if (isMatch) {
                qcPassedTotal += item.qcPassedQuantity || 0;
              }
            }
          } else {
            let isMatch = false;
            if (o.sku && p.sku) {
              isMatch = o.sku.trim().toLowerCase() === p.sku.trim().toLowerCase();
            } else if (o.productName && p.name) {
              const nameMatch = o.productName.trim().toLowerCase() === p.name.trim().toLowerCase();
              const colorMatch = !o.colorName || !p.colorName || o.colorName.trim().toLowerCase() === p.colorName.trim().toLowerCase();
              const sizeMatch = !o.sizeName || !p.sizeName || o.sizeName.trim().toLowerCase() === p.sizeName.trim().toLowerCase();
              isMatch = nameMatch && colorMatch && sizeMatch;
            }
            if (isMatch) {
              qcPassedTotal += o.qcPassedQuantity || 0;
            }
          }
        }
      }

      const manualOverride = localStockOverrides[p.id] || localStockOverrides[p.sku] || 0;

      return {
        ...p,
        quantity: (p.quantity || 0) + qcPassedTotal + manualOverride,
      };
    });
  }, [initialProducts, factoryOrders, localStockOverrides]);

  const [poSearch, setPoSearch] = useState("");
  const [poStatusFilter, setPoStatusFilter] = useState<string>("ALL");

  // Modals for Tab Nhập hàng
  const [showAddPoModal, setShowAddPoModal] = useState(false);
  const [showQcModal, setShowQcModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState<FactoryOrder | null>(null);

  // Batch Detail Modal State
  const [showBatchDetailModal, setShowBatchDetailModal] = useState(false);
  const [selectedPoForDetail, setSelectedPoForDetail] = useState<FactoryOrder | null>(null);

  const openBatchDetailModal = (po: FactoryOrder) => {
    setSelectedPoForDetail(po);
    setShowBatchDetailModal(true);
  };

  const handleDeleteBatchOrder = async (po: FactoryOrder) => {
    const isCompleted = po.status === "COMPLETED" || (po.qcPassedQuantity !== undefined && po.qcPassedQuantity > 0);

    const isOk = await confirm({
      title: isCompleted
        ? `⚠️ Cảnh báo: Xóa phiếu đã nhập kho ${po.batchCode}?`
        : `Xóa phiếu đặt NSX ${po.batchCode}?`,
      description: isCompleted
        ? `Phiếu đặt lô hàng ${po.batchCode} đã được nhập kho (${(po.qcPassedQuantity || po.orderQuantity).toLocaleString()} sản phẩm). Nếu bạn xóa phiếu đặt này, hệ thống sẽ tự động XÓA / TRỪ TOÀN BỘ TỒN KHO tương ứng của các sản phẩm trong lô hàng khỏi kho dữ liệu. Bạn có chắc chắn muốn tiếp tục không?`
        : `Bạn có chắc chắn muốn xóa phiếu đặt NSX này không? Dữ liệu lô hàng sẽ bị loại bỏ khỏi danh sách.`,
      confirmLabel: isCompleted ? "Xóa phiếu & Trừ tồn kho" : "Xóa lô hàng",
      cancelLabel: "Hủy",
      tone: "destructive",
    });

    if (isOk) {
      try {
        const res = await fetch(`/api/factory-orders/${po.id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Lỗi xoá phiếu đặt");
        }
        await mutatePos();
        setShowBatchDetailModal(false);
        setSelectedPoForDetail(null);
        notify({
          tone: "success",
          title: "Đã xóa lô hàng thành công",
          body: isCompleted
            ? `Đã xóa phiếu đặt ${po.batchCode} và trừ tồn kho tương ứng.`
            : `Đã xóa phiếu đặt NSX ${po.batchCode}`,
        });
      } catch (e: any) {
        notify({ tone: "error", title: "Lỗi", body: e.message });
      }
    }
  };

  // Batch Label Print Modal State (Tem Lô Hàng 3.5cm x 2.5cm)
  const [showBatchLabelModal, setShowBatchLabelModal] = useState(false);
  const [selectedPoForBatchLabel, setSelectedPoForBatchLabel] = useState<FactoryOrder | null>(null);
  const [batchLabelConfig, setBatchLabelConfig] = useState<BatchLabelConfig>({
    widthMm: 35,
    heightMm: 25,
    showSku: true,
    showBatchCode: true,
    showOrderDate: true,
    showReceivedDate: true,
    showManufacturer: true,
    printQuantity: 10,
  });

  // NSX Defect Ticket Return Modal State
  const [showReturnDefectModal, setShowReturnDefectModal] = useState(false);
  const [selectedReturnPo, setSelectedReturnPo] = useState<FactoryOrder | null>(null);

  // New PO Form State (Multi-item Support)
  type PoItemInput = {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    colorName: string;
    sizeName: string;
    orderQuantity: number;
  };

  const [poMfrName, setPoMfrName] = useState("");
  const [poOrderDate, setPoOrderDate] = useState(todayStr);
  const [poExpectedDate, setPoExpectedDate] = useState("");
  const [poNotes, setPoNotes] = useState("");

  const [poItems, setPoItems] = useState<PoItemInput[]>([
    { id: "item-init-1", productId: "", productName: "", sku: "", colorName: "", sizeName: "", orderQuantity: 100 }
  ]);

  const addPoItemRow = () => {
    setPoItems((prev) => [
      ...prev,
      { id: `item-${Date.now()}-${prev.length}`, productId: "", productName: "", sku: "", colorName: "", sizeName: "", orderQuantity: 100 }
    ]);
  };

  const removePoItemRow = (id: string) => {
    setPoItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const updatePoItemRow = (id: string, field: keyof PoItemInput, val: any) => {
    setPoItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === "productId") {
          const prod = products.find((p) => p.id === val);
          if (prod) {
            return {
              ...item,
              productId: val,
              productName: prod.name,
              sku: prod.sku,
              colorName: prod.colorName || "",
              sizeName: prod.sizeName || "",
            };
          }
        }
        return { ...item, [field]: val };
      })
    );
  };

  // QC Inspection Item State
  type QcItemState = {
    itemId: string;
    productName: string;
    sku?: string | null;
    colorName?: string | null;
    sizeName?: string | null;
    orderQuantity: number;
    passedQty: number;
    failedQty: number;
  };

  const [qcItemStates, setQcItemStates] = useState<QcItemState[]>([]);
  const [qcFailReasonNotes, setQcFailReasonNotes] = useState("");
  const [qcNotes, setQcNotes] = useState("");

  // Tab 3: Tồn kho State & Barcode Lookup
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStockFilter, setInventoryStockFilter] = useState<"ALL" | "LOW_STOCK" | "OUT_OF_STOCK" | "IN_STOCK">("ALL");
  const [selectedInventoryProduct, setSelectedInventoryProduct] = useState<Product | null>(null);
  const [showInventoryLookupDrawer, setShowInventoryLookupDrawer] = useState(false);

  // Barcode Printing state (Sales Barcode Tag Modal)
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<Product | null>(null);

  // Check Overdue Orders
  const overdueOrders = useMemo(() => {
    return factoryOrders.filter(
      (o) => o.status !== "COMPLETED" && o.status !== "PARTIAL_RETURN" && o.expectedDate && o.expectedDate < todayStr
    );
  }, [factoryOrders, todayStr]);

  // Handle Create New Factory Purchase Order (Multi-Item Order Support)
  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poMfrName.trim()) {
      return notify({ tone: "error", title: "Thiếu thông tin", body: "Vui lòng chọn Nhà sản xuất (NSX)." });
    }

    const validItems = poItems.filter((i) => i.productName.trim() && i.orderQuantity > 0);
    if (validItems.length === 0) {
      return notify({ tone: "error", title: "Chưa có sản phẩm", body: "Vui lòng thêm ít nhất 1 sản phẩm/biến thể và nhập số lượng đặt." });
    }

    const totalQty = validItems.reduce((acc, i) => acc + i.orderQuantity, 0);
    const mainItem = validItems[0];
    const summaryTitle = validItems.length > 1
      ? `${mainItem.productName} (+${validItems.length - 1} biến thể khác)`
      : `${mainItem.productName}${mainItem.colorName ? ` • ${mainItem.colorName}` : ""}${mainItem.sizeName ? ` (${mainItem.sizeName})` : ""}`;

    const orderNum = factoryOrders.length + 1;
    const letters = "YBCADAEFGHJKLMNPQRSTUVWXYZ";
    const letter = letters[orderNum % letters.length];
    const num = String((orderNum % 99) || 1).padStart(2, "0");
    const batchCode = `${letter}${num}`;
    const code = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(orderNum).padStart(3, "0")}`;
    try {
      const res = await fetch("/api/factory-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          batchCode,
          manufacturerName: poMfrName,
          productName: summaryTitle,
          sku: mainItem.sku || undefined,
          productId: mainItem.productId || undefined,
          orderQuantity: totalQty,
          orderDate: poOrderDate || todayStr,
          expectedDate: poExpectedDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          qcNotes: poNotes,
          status: "IN_PRODUCTION",
          items: validItems.map((item) => ({
            productId: item.productId || undefined,
            productName: item.productName,
            sku: item.sku || "",
            colorName: item.colorName || undefined,
            sizeName: item.sizeName || undefined,
            orderQuantity: item.orderQuantity,
            qcPassedQuantity: 0,
            qcFailedQuantity: 0,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lỗi tạo đơn đặt NSX");
      }

      const resData = await res.json();
      const createdPo = resData.order;
      await mutatePos();

      notify({
        tone: "success",
        title: "Tạo phiếu đặt NSX thành công",
        body: `Phiếu ${code} (${validItems.length} mặt hàng - Tổng ${totalQty} cái) đã tạo cho ${poMfrName}`,
      });
      setShowAddPoModal(false);

      // Reset Form
      setPoItems([{ id: "item-init-1", productId: "", productName: "", sku: "", colorName: "", sizeName: "", orderQuantity: 100 }]);

      // Prompt to print Batch Labels immediately
      setSelectedPoForBatchLabel(createdPo);
      setBatchLabelConfig((prev) => ({ ...prev, printQuantity: totalQty }));
      setShowBatchLabelModal(true);

      // Reset Form
      setPoMfrName("");
      setPoExpectedDate("");
      setPoNotes("");
    } catch (e: any) {
      notify({ tone: "error", title: "Lỗi", body: e.message });
    }
    setPoItems([{ id: "item-init-1", productId: "", productName: "", sku: "", colorName: "", sizeName: "", orderQuantity: 100 }]);
  };

  // Open QC Inspection Modal (Supports Item/Variant-level QC)
  const openQcModal = (po: FactoryOrder) => {
    setSelectedPo(po);
    setShowQcModal(true);
  };

  useEffect(() => {
    if (showQcModal && selectedPo) {
      const isNewInspection = selectedPo.status === "QC_INSPECTION" || selectedPo.status === "IN_PRODUCTION";

      if (selectedPo.items && selectedPo.items.length > 0) {
        const itemsInit = selectedPo.items.map((item) => {
          const hasQcRecord = !isNewInspection && (item.qcPassedQuantity !== undefined || item.qcFailedQuantity !== undefined);
          const passed = hasQcRecord
            ? (item.qcPassedQuantity ?? item.orderQuantity)
            : item.orderQuantity;
          const failed = hasQcRecord
            ? (item.qcFailedQuantity ?? Math.max(0, item.orderQuantity - passed))
            : 0;
          return {
            itemId: item.id,
            productName: item.productName,
            sku: item.sku,
            colorName: item.colorName,
            sizeName: item.sizeName,
            orderQuantity: item.orderQuantity,
            passedQty: passed,
            failedQty: failed,
          };
        });
        setQcItemStates(itemsInit);
      } else {
        const hasQcRecord = !isNewInspection && (selectedPo.qcPassedQuantity !== undefined || selectedPo.qcFailedQuantity !== undefined);
        const passed = hasQcRecord
          ? (selectedPo.qcPassedQuantity ?? selectedPo.orderQuantity)
          : selectedPo.orderQuantity;
        const failed = hasQcRecord
          ? (selectedPo.qcFailedQuantity ?? Math.max(0, selectedPo.orderQuantity - passed))
          : 0;
        setQcItemStates([
          {
            itemId: "item-single",
            productName: selectedPo.productName,
            sku: selectedPo.sku || "SKU-AUTO",
            colorName: selectedPo.colorName,
            sizeName: selectedPo.sizeName,
            orderQuantity: selectedPo.orderQuantity,
            passedQty: passed,
            failedQty: failed,
          },
        ]);
      }
      setQcFailReasonNotes(selectedPo.failReasonNotes || "");
      setQcNotes(selectedPo.qcNotes || "");
    }
  }, [showQcModal, selectedPo]);

  const updateQcItemQty = (itemId: string, type: "passed" | "failed", valueStr: string) => {
    const val = Math.max(0, Number(valueStr) || 0);
    setQcItemStates((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;
        if (type === "passed") {
          const newPassed = Math.min(item.orderQuantity, val);
          const newFailed = Math.max(0, item.orderQuantity - newPassed);
          return { ...item, passedQty: newPassed, failedQty: newFailed };
        } else {
          const newFailed = Math.min(item.orderQuantity, val);
          const newPassed = Math.max(0, item.orderQuantity - newFailed);
          return { ...item, passedQty: newPassed, failedQty: newFailed };
        }
      })
    );
  };

  // Open Batch Label Printing Modal
  const openBatchLabelModal = (po: FactoryOrder) => {
    setSelectedPoForBatchLabel(po);
    setBatchLabelConfig((prev) => ({ ...prev, printQuantity: po.orderQuantity }));
    setShowBatchLabelModal(true);
  };

  // Open Return Defect Ticket Modal
  const openReturnDefectModal = (po: FactoryOrder) => {
    setSelectedReturnPo(po);
    setShowReturnDefectModal(true);
  };

  // Save QC Inspection Result & Auto Update Inventory
  const handleSaveQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;

    const totalPassed = qcItemStates.reduce((acc, i) => acc + (Number(i.passedQty) || 0), 0);
    const totalFailed = qcItemStates.reduce((acc, i) => acc + (Number(i.failedQty) || 0), 0);

    const isAllPass = totalFailed === 0;
    const newStatus: FactoryOrder["status"] = totalFailed > 0 ? "PARTIAL_RETURN" : "COMPLETED";

    const updatedItems = (selectedPo.items || []).map((item) => {
      const match = qcItemStates.find((st) => st.itemId === item.id);
      if (match) {
        return {
          ...item,
          qcPassedQuantity: match.passedQty,
          qcFailedQuantity: match.failedQty,
        };
      }
      return item;
    });

    const updatedPo: FactoryOrder = {
      ...selectedPo,
      qcPassedQuantity: totalPassed,
      qcFailedQuantity: totalFailed,
      status: newStatus,
      receivedDate: todayStr,
      qcNotes: qcNotes,
      failReasonNotes: qcFailReasonNotes,
      items: updatedItems.length > 0 ? updatedItems : selectedPo.items,
    };

    const failedBatchCode = `${selectedPo.batchCode}-F`;
    const failedItems = qcItemStates
      .filter((st) => st.failedQty > 0)
      .map((st) => ({
        productId: (selectedPo.items || []).find((it) => it.id === st.itemId)?.productId,
        productName: st.productName,
        sku: st.sku,
        colorName: st.colorName,
        sizeName: st.sizeName,
        orderQuantity: st.failedQty,
        qcPassedQuantity: 0,
        qcFailedQuantity: st.failedQty,
      }));

    const failedPoPayload = !isAllPass
      ? {
          code: `PO-F-${selectedPo.code}`,
          batchCode: failedBatchCode,
          manufacturerId: selectedPo.manufacturerId,
          manufacturerName: selectedPo.manufacturerName,
          productName: selectedPo.productName,
          sku: selectedPo.sku,
          colorName: selectedPo.colorName,
          sizeName: selectedPo.sizeName,
          orderQuantity: totalFailed,
          qcPassedQuantity: 0,
          qcFailedQuantity: totalFailed,
          orderDate: selectedPo.orderDate,
          expectedDate: selectedPo.expectedDate,
          qcNotes: qcNotes,
          failReasonNotes: qcFailReasonNotes || "Hàng lỗi trả NSX sửa hoặc thay mới",
          items: failedItems,
        }
      : undefined;

    try {
      const res = await fetch(`/api/factory-orders/${selectedPo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qcPassedQuantity: totalPassed,
          qcFailedQuantity: totalFailed,
          status: newStatus,
          receivedDate: todayStr,
          qcNotes: qcNotes,
          failReasonNotes: qcFailReasonNotes,
          items: updatedItems,
          failedPo: failedPoPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lỗi lưu kết quả QC");
      }

      const resData = await res.json();
      const serverUpdatedPo = resData.order;
      const createdFailedPo = resData.failedPo;
      await mutatePos();

      // TH1: ALL PRODUCTS PASS 100% QC
      if (isAllPass) {
        notify({
          tone: "success",
          title: "🎉 QC thành công 100% & Đã Nhập Kho!",
          body: `Toàn bộ ${totalPassed.toLocaleString()} sản phẩm lô ${selectedPo.batchCode} đã đạt QC và cộng trực tiếp vào kho!`,
        });

        setShowQcModal(false);
        setSelectedPo(null);

        // Auto open print label modal for completed sale labels
        openBatchLabelModal(serverUpdatedPo || selectedPo);
      } 
      // TH2: PARTIAL QC PASS / DEFECTIVE ITEMS EXIST (totalFailed > 0)
      else {
        notify({
          tone: "warning",
          title: `⚠️ Đã tách lô lỗi ${failedBatchCode} trả NSX!`,
          body: `Đã nhập kho ${totalPassed.toLocaleString()} sản phẩm đạt QC và tự động tạo phiếu lô lỗi ${failedBatchCode} (${totalFailed.toLocaleString()} cái) để in tem trả NSX!`,
        });

        setShowQcModal(false);
        setSelectedPo(null);

        // Auto open print label modal for defective batch to print defect tags!
        openBatchLabelModal(createdFailedPo || serverUpdatedPo || selectedPo);
      }
    } catch (e: any) {
      notify({ tone: "error", title: "Lỗi", body: e.message });
    }
  };

  // Quick switch from Inventory tab to Factory Order tab with pre-filled product name
  const handleOrderMoreFromFactory = (prodName: string, skuStr?: string, mfrNameStr?: string, prodIdStr?: string) => {
    if (mfrNameStr) setPoMfrName(mfrNameStr);
    setPoItems([
      {
        id: `item-${Date.now()}`,
        productId: prodIdStr || "",
        productName: prodName,
        sku: skuStr || "",
        colorName: "",
        sizeName: "",
        orderQuantity: 100,
      }
    ]);
    setActiveSubTab("import");
    setShowAddPoModal(true);
  };

  // Filtered Factory Orders
  const filteredFactoryOrders = useMemo(() => {
    return factoryOrders.filter((o) => {
      const matchSearch =
        o.code.toLowerCase().includes(poSearch.toLowerCase()) ||
        o.batchCode.toLowerCase().includes(poSearch.toLowerCase()) ||
        o.manufacturerName.toLowerCase().includes(poSearch.toLowerCase()) ||
        o.productName.toLowerCase().includes(poSearch.toLowerCase()) ||
        (o.sku && o.sku.toLowerCase().includes(poSearch.toLowerCase()));

      let matchStatus = true;
      if (poStatusFilter === "OVERDUE") {
        matchStatus = o.status !== "COMPLETED" && o.status !== "PARTIAL_RETURN" && !!o.expectedDate && o.expectedDate < todayStr;
      } else if (poStatusFilter !== "ALL") {
        matchStatus = o.status === poStatusFilter;
      }
      return matchSearch && matchStatus;
    });
  }, [factoryOrders, poSearch, poStatusFilter, todayStr]);

  // Filtered Inventory Products
  const filteredInventoryProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        (p.barcode && p.barcode.includes(inventorySearch));

      const qty = p.quantity || 0;
      let matchStock = true;
      if (inventoryStockFilter === "LOW_STOCK") matchStock = qty <= 5 && qty > 0;
      if (inventoryStockFilter === "OUT_OF_STOCK") matchStock = qty === 0;
      if (inventoryStockFilter === "IN_STOCK") matchStock = qty > 5;

      return matchSearch && matchStock;
    });
  }, [products, inventorySearch, inventoryStockFilter]);

  type InventoryGroupType = {
    key: string;
    name: string;
    category: Product["category"];
    subcategory: Product["subcategory"];
    itemCode: string;
    colorName?: string | null;
    colorCode?: string | null;
    baseSku: string;
    imageUrl?: string | null;
    totalQuantity: number;
    totalIncomingQuantity: number;
    minPrice: number;
    maxPrice: number;
    hasLowStock: boolean;
    hasOutOfStock: boolean;
    colors: string[];
    sizes: string[];
    variants: (Product & { incomingQuantity: number })[];
  };

  const getIncomingQtyForSku = useCallback(
    (sku: string, name: string, colorName?: string | null, sizeName?: string | null) => {
      let count = 0;
      for (const o of factoryOrders) {
        if (o.status !== "COMPLETED" && o.status !== "PARTIAL_RETURN") {
          if (o.items && o.items.length > 0) {
            for (const item of o.items) {
              let isMatch = false;
              if (item.sku && sku) {
                isMatch = item.sku.trim().toLowerCase() === sku.trim().toLowerCase();
              } else if (item.productName && name) {
                const nameMatch = item.productName.trim().toLowerCase() === name.trim().toLowerCase();
                const colorMatch = !item.colorName || !colorName || item.colorName.trim().toLowerCase() === colorName.trim().toLowerCase();
                const sizeMatch = !item.sizeName || !sizeName || item.sizeName.trim().toLowerCase() === sizeName.trim().toLowerCase();
                isMatch = nameMatch && colorMatch && sizeMatch;
              }
              if (isMatch) {
                count += Math.max(0, item.orderQuantity - (item.qcPassedQuantity || 0));
              }
            }
          } else {
            let isMatch = false;
            if (o.sku && sku) {
              isMatch = o.sku.trim().toLowerCase() === sku.trim().toLowerCase();
            } else if (o.productName && name) {
              const nameMatch = o.productName.trim().toLowerCase() === name.trim().toLowerCase();
              const colorMatch = !o.colorName || !colorName || o.colorName.trim().toLowerCase() === colorName.trim().toLowerCase();
              const sizeMatch = !o.sizeName || !sizeName || o.sizeName.trim().toLowerCase() === sizeName.trim().toLowerCase();
              isMatch = nameMatch && colorMatch && sizeMatch;
            }
            if (isMatch) {
              count += Math.max(0, o.orderQuantity - (o.qcPassedQuantity || 0));
            }
          }
        }
      }
      return count;
    },
    [factoryOrders]
  );

  const groupedInventoryProducts = useMemo(() => {
    const groupsMap = new Map<string, InventoryGroupType>();

    for (const p of filteredInventoryProducts) {
      // Group by 6-character prefix: [Cat(1)][Subcat(1)][ItemCode(2)][ColorCode(2)]
      const skuClean = (p.sku || "").trim().toUpperCase();
      const sku6Prefix = skuClean.length >= 6
        ? skuClean.slice(0, 6)
        : `${p.category.codeLetter}${p.subcategory.codeLetter}${(p.itemCode || "01").padStart(2, "0")}${(p.colorCode || "00").padStart(2, "0")}`;

      const key = `${p.category.id}_${p.subcategory.id}_${p.itemCode || "01"}_${p.colorCode || p.colorName || "default"}`;
      let group = groupsMap.get(key);

      if (!group) {
        group = {
          key,
          name: p.name,
          category: p.category,
          subcategory: p.subcategory,
          itemCode: p.itemCode || "01",
          colorName: p.colorName || null,
          colorCode: p.colorCode || null,
          baseSku: sku6Prefix,
          imageUrl: p.imageUrl,
          totalQuantity: 0,
          totalIncomingQuantity: 0,
          minPrice: p.sellingPrice,
          maxPrice: p.sellingPrice,
          hasLowStock: false,
          hasOutOfStock: false,
          colors: [],
          sizes: [],
          variants: [],
        };
        groupsMap.set(key, group);
      }

      const qty = p.quantity || 0;
      const incomingQty = getIncomingQtyForSku(p.sku, p.name, p.colorName, p.sizeName);

      group.totalQuantity += qty;
      group.totalIncomingQuantity += incomingQty;

      if (qty === 0) group.hasOutOfStock = true;
      if (qty <= 5) group.hasLowStock = true;
      if (p.sellingPrice < group.minPrice) group.minPrice = p.sellingPrice;
      if (p.sellingPrice > group.maxPrice) group.maxPrice = p.sellingPrice;
      if (p.imageUrl && !group.imageUrl) group.imageUrl = p.imageUrl;
      if (p.colorName && !group.colors.includes(p.colorName)) group.colors.push(p.colorName);
      if (p.sizeName && !group.sizes.includes(p.sizeName)) group.sizes.push(p.sizeName);

      group.variants.push({ ...p, incomingQuantity: incomingQty });
    }

    return Array.from(groupsMap.values());
  }, [filteredInventoryProducts, getIncomingQtyForSku]);

  const [expandedInventoryGroups, setExpandedInventoryGroups] = useState<Record<string, boolean>>({});

  const toggleInventoryGroup = (key: string) => {
    setExpandedInventoryGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (inventorySearch.trim()) {
      const newExpanded: Record<string, boolean> = {};
      groupedInventoryProducts.forEach((g) => {
        newExpanded[g.key] = true;
      });
      setExpandedInventoryGroups(newExpanded);
    }
  }, [inventorySearch, groupedInventoryProducts]);

  // Open Inventory Scanner / Lookup Drawer
  const openInventoryLookup = (product: Product) => {
    setSelectedInventoryProduct(product);
    setShowInventoryLookupDrawer(true);
  };

  // Search & Filters for Products Tab
  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("ALL");

  // Modals for Products Tab
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMfrModal, setShowMfrModal] = useState(false);
  const [showMfrListModal, setShowMfrListModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Form State for Add Product
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [colorName, setColorName] = useState("");
  const [sizeName, setSizeName] = useState("");
  const [unit, setUnit] = useState("Cái");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Dropdown Open States
  const [openBrandDropdown, setOpenBrandDropdown] = useState(false);
  const [openCatDropdown, setOpenCatDropdown] = useState(false);
  const [openMatDropdown, setOpenMatDropdown] = useState(false);

  // Form State for Manufacturer
  const [editingMfr, setEditingMfr] = useState<Manufacturer | null>(null);
  const [mfrName, setMfrName] = useState("");
  const [mfrCode, setMfrCode] = useState("");
  const [mfrAddress, setMfrAddress] = useState("");
  const [mfrPhone, setMfrPhone] = useState("");
  const [mfrTaxId, setMfrTaxId] = useState("");
  const [isMfrSubmitting, setIsMfrSubmitting] = useState(false);

  // Handle Add Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    if (!name.trim()) return notify({ tone: "error", title: "Thiếu dữ liệu", body: "Vui lòng nhập tên sản phẩm" });
    if (!categoryName.trim()) return notify({ tone: "error", title: "Thiếu dữ liệu", body: "Vui lòng nhập Loại hàng" });
    if (!subcategoryName.trim()) return notify({ tone: "error", title: "Thiếu dữ liệu", body: "Vui lòng nhập Chủng loại sản phẩm" });

    setIsSubmitting(true);
    try {
      const finalColorName = selectedColors.length > 0 ? selectedColors.join(", ") : colorName;
      const finalSizeName = selectedSizes.length > 0 ? selectedSizes.join(", ") : sizeName;

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          brandName,
          categoryName,
          categoryCodeLetter: previewData.catLet,
          subcategoryName,
          subcategoryCodeLetter: previewData.subcatLet,
          manufacturerId: manufacturerId || null,
          colorName: finalColorName,
          sizeName: finalSizeName,
          unit,
          costPrice: parseFloat(costPrice) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
          imageUrl,
          description,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Tạo sản phẩm thất bại");

      notify({ tone: "success", title: "Thành công", body: `Đã thêm sản phẩm "${result.name}"` });
      setShowAddModal(false);
      resetProductForm();
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add/Edit Manufacturer
  const handleAddManufacturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfrName.trim()) return notify({ tone: "error", title: "Thiếu dữ liệu", body: "Vui lòng nhập tên nhà sản xuất" });

    setIsMfrSubmitting(true);
    try {
      const url = editingMfr ? `/api/manufacturers/${editingMfr.id}` : "/api/manufacturers";
      const method = editingMfr ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mfrName,
          code: mfrCode,
          address: mfrAddress,
          phone: mfrPhone,
          taxId: mfrTaxId,
        }),
      });

      const result = await res.json();
      if (editingMfr) {
        notify({ tone: "success", title: "Cập nhật thành công", body: `Đã sửa thông tin Nhà sản xuất "${result.name}"` });
      } else {
        notify({ tone: "success", title: "Tạo NSX thành công", body: `Đã thêm Nhà sản xuất "${result.name}" (Mã: ${result.code})` });
      }

      if (!editingMfr) setManufacturerId(result.id);
      setShowMfrModal(false);
      setEditingMfr(null);
      setMfrName("");
      setMfrCode("");
      setMfrAddress("");
      setMfrPhone("");
      setMfrTaxId("");
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setIsMfrSubmitting(false);
    }
  };

  // Dynamic Categories, Materials & Brands lists loaded clean without hardcoded demo presets
  const [categoriesList, setCategoriesList] = useState<{ name: string; letter: string }[]>([]);
  const [materialsList, setMaterialsList] = useState<{ name: string; letter: string }[]>([]);
  const [brandsList, setBrandsList] = useState<string[]>([]);

  const [colorChipsList, setColorChipsList] = useState<string[]>([
    "Đen", "Trắng", "Xanh Denim", "Đỏ", "Vàng", "Xanh Lá", "Nâu", "Tím", "Xám", "Kem/Beige"
  ]);

  const [sizeChipsList, setSizeChipsList] = useState<string[]>([
    "S", "M", "L", "XL", "2XL", "3XL", "FreeSize"
  ]);

  // Sync Categories and Materials from Database when loaded
  useEffect(() => {
    if (categories && categories.length > 0) {
      const cats = categories.map((c) => ({ name: c.name, letter: c.codeLetter }));
      setCategoriesList((prev) => {
        const merged = [...prev];
        for (const c of cats) {
          if (!merged.some((m) => m.name === c.name)) merged.push(c);
        }
        return merged;
      });

      const mats: { name: string; letter: string }[] = [];
      for (const c of categories) {
        for (const s of c.subcategories || []) {
          if (!mats.some((m) => m.name === s.name)) {
            mats.push({ name: s.name, letter: s.codeLetter });
          }
        }
      }
      setMaterialsList((prev) => {
        const merged = [...prev];
        for (const m of mats) {
          if (!merged.some((x) => x.name === m.name)) merged.push(m);
        }
        return merged;
      });
    }
  }, [categories]);

  // Sync Brands from existing products when loaded
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      const brands = Array.from(new Set(initialProducts.map((p) => p.brandName).filter(Boolean))) as string[];
      if (brands.length > 0) {
        setBrandsList((prev) => Array.from(new Set([...prev, ...brands])));
      }
    }
  }, [initialProducts]);

  // States for Add/Edit Mode in Modal
  const [catMode, setCatMode] = useState<"SELECT" | "ADD" | "EDIT">("SELECT");
  const [matMode, setMatMode] = useState<"SELECT" | "ADD" | "EDIT">("SELECT");
  const [brandMode, setBrandMode] = useState<"SELECT" | "ADD" | "EDIT">("SELECT");

  const [customCatLetter, setCustomCatLetter] = useState(() => getRandomCapitalLetter());
  const [customMatLetter, setCustomMatLetter] = useState(() => getRandomCapitalLetter());

  // Edit buffer states
  const [editCatName, setEditCatName] = useState("");
  const [editCatLetter, setEditCatLetter] = useState("");
  const [editMatName, setEditMatName] = useState("");
  const [editMatLetter, setEditMatLetter] = useState("");
  const [modalBrandEditName, setModalBrandEditName] = useState("");

  // States for Color & Size Badge Chips (Starts Clean)
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [customColorInput, setCustomColorInput] = useState("");
  const [customSizeInput, setCustomSizeInput] = useState("");

  const addCustomColor = () => {
    if (!customColorInput.trim()) return;
    const val = customColorInput.trim();
    if (!colorChipsList.includes(val)) {
      setColorChipsList([...colorChipsList, val]);
    }
    if (!selectedColors.includes(val)) {
      const next = [...selectedColors, val];
      setSelectedColors(next);
      setColorName(next.join(", "));
    }
    setCustomColorInput("");
  };

  const handleEditColorChip = (oldVal: string) => {
    const newVal = prompt("Chỉnh sửa tên màu sắc:", oldVal);
    if (newVal && newVal.trim() && newVal.trim() !== oldVal) {
      const trimmed = newVal.trim();
      setColorChipsList(colorChipsList.map((c) => (c === oldVal ? trimmed : c)));
      const nextSel = selectedColors.map((c) => (c === oldVal ? trimmed : c));
      setSelectedColors(nextSel);
      setColorName(nextSel.join(", "));
    }
  };

  const handleDeleteColorChip = async (valToDelete: string) => {
    const ok = await confirm({
      title: "Xác nhận xóa màu sắc",
      description: `Bạn có chắc muốn xóa màu "${valToDelete}" khỏi danh sách lựa chọn? (Không ảnh hưởng đến các SKU đã được tạo sẵn)`,
      confirmLabel: "Xóa",
      cancelLabel: "Huỷ",
      tone: "destructive",
    });
    if (ok) {
      setColorChipsList((prev) => prev.filter((c) => c !== valToDelete));
      setSelectedColors((prev) => {
        const nextSel = prev.filter((c) => c !== valToDelete);
        setColorName(nextSel.join(", "));
        return nextSel;
      });
    }
  };

  const addCustomSize = () => {
    if (!customSizeInput.trim()) return;
    const val = customSizeInput.trim().toUpperCase();
    if (!sizeChipsList.includes(val)) {
      setSizeChipsList([...sizeChipsList, val]);
    }
    if (!selectedSizes.includes(val)) {
      const next = [...selectedSizes, val];
      setSelectedSizes(next);
      setSizeName(next.join(", "));
    }
    setCustomSizeInput("");
  };

  const handleEditSizeChip = (oldVal: string) => {
    const newVal = prompt("Chỉnh sửa kích thước / size:", oldVal);
    if (newVal && newVal.trim() && newVal.trim().toUpperCase() !== oldVal) {
      const trimmed = newVal.trim().toUpperCase();
      setSizeChipsList(sizeChipsList.map((s) => (s === oldVal ? trimmed : s)));
      const nextSel = selectedSizes.map((s) => (s === oldVal ? trimmed : s));
      setSelectedSizes(nextSel);
      setSizeName(nextSel.join(", "));
    }
  };

  const handleDeleteSizeChip = async (valToDelete: string) => {
    const ok = await confirm({
      title: "Xác nhận xóa kích thước",
      description: `Bạn có chắc muốn xóa size "${valToDelete}" khỏi danh sách lựa chọn? (Không ảnh hưởng đến các SKU đã được tạo sẵn)`,
      confirmLabel: "Xóa",
      cancelLabel: "Huỷ",
      tone: "destructive",
    });
    if (ok) {
      setSizeChipsList((prev) => prev.filter((s) => s !== valToDelete));
      setSelectedSizes((prev) => {
        const nextSel = prev.filter((s) => s !== valToDelete);
        setSizeName(nextSel.join(", "));
        return nextSel;
      });
    }
  };

  const resetProductForm = () => {
    setName("");
    setBrandName("");
    setCategoryName("");
    setSubcategoryName("");
    setCustomCatLetter(getRandomCapitalLetter());
    setCustomMatLetter(getRandomCapitalLetter());
    setManufacturerId("");
    setSelectedColors([]);
    setSelectedSizes([]);
    setColorName("");
    setSizeName("");
    setUnit("Cái");
    setCostPrice("");
    setSellingPrice("");
    setImageUrl("");
    setDescription("");
    setCatMode("SELECT");
    setMatMode("SELECT");
    setBrandMode("SELECT");
  };

  // Live SKU & Barcode preview calculation (Guaranteed Unique)
  const previewData = useMemo(() => {
    const catObj = categoriesList.find((c) => c.name === categoryName);
    const catLet = catMode === "ADD" 
      ? (customCatLetter || "A").slice(0, 1).toUpperCase() 
      : catMode === "EDIT" 
      ? (editCatLetter || "A").slice(0, 1).toUpperCase() 
      : (catObj ? catObj.letter : (stringToUniqueLetter(categoryName) || (customCatLetter || "A")));

    const matObj = materialsList.find((m) => m.name === subcategoryName);
    const subcatLet = matMode === "ADD" 
      ? (customMatLetter || "A").slice(0, 1).toUpperCase() 
      : matMode === "EDIT" 
      ? (editMatLetter || "A").slice(0, 1).toUpperCase() 
      : (matObj ? matObj.letter : (stringToUniqueLetter(subcategoryName) || (customMatLetter || "A")));

    const existingSkus = products.map((p) => p.sku).filter(Boolean);
    const itemCode = getUniqueItemCode(existingSkus, catLet, subcatLet);

    const colors = selectedColors.length > 0 ? selectedColors : colorName.split(",").map((c) => c.trim()).filter(Boolean);
    const sizes = selectedSizes.length > 0 ? selectedSizes : sizeName.split(",").map((s) => s.trim()).filter(Boolean);
    const variantCount = Math.max(1, (colors.length || 1) * (sizes.length || 1));

    const firstColor = colors[0] || "";
    const firstSize = sizes[0] || "";

    const colCode = getColorCode(firstColor);
    const szCode = getSizeCode(firstSize);
    const skuPreview = categoryName && subcategoryName
      ? generateSku(catLet, subcatLet, itemCode, colCode, szCode)
      : `${catLet}${subcatLet}${itemCode}xxxx`;

    const mfr = manufacturers.find((m) => m.id === manufacturerId);
    const mCode = mfr ? mfr.code : "000";
    const barcodePreview = generateEan8Barcode(mCode, "0001");

    return { skuPreview, barcodePreview, variantCount, colorCount: colors.length, sizeCount: sizes.length, catLet, subcatLet, itemCode };
  }, [categoryName, subcategoryName, customCatLetter, customMatLetter, editCatLetter, editMatLetter, catMode, matMode, selectedColors, selectedSizes, colorName, sizeName, manufacturerId, manufacturers, categoriesList, materialsList, products]);

  // Grouped Products calculation for Tab Sản phẩm (Tách cụm theo Màu, trùng 6 ký tự đầu SKU)
  type GroupItemType = {
    key: string;
    name: string;
    category: Product["category"];
    subcategory: Product["subcategory"];
    manufacturer?: Product["manufacturer"];
    itemCode: string;
    colorName?: string | null;
    colorCode?: string | null;
    baseSku: string;
    imageUrl?: string | null;
    variants: Product[];
    colors: string[];
    sizes: string[];
    minPrice: number;
    maxPrice: number;
  };

  const [editingGroup, setEditingGroup] = useState<GroupItemType | null>(null);
  const [editingVariant, setEditingVariant] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editBrandName, setEditBrandName] = useState("");
  const [editColorsInput, setEditColorsInput] = useState("");
  const [editSizesInput, setEditSizesInput] = useState("");
  const [editManufacturerId, setEditManufacturerId] = useState("");
  const [editColorName, setEditColorName] = useState("");
  const [editSizeName, setEditSizeName] = useState("");
  const [editUnit, setEditUnit] = useState("Cái");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const openGroupEdit = (g: GroupItemType) => {
    setEditingGroup(g);
    setEditName(g.name);
    setEditBrandName(g.variants[0]?.brandName || "");
    const colorsList = g.colorName ? [g.colorName] : Array.from(new Set(g.variants.map((v) => v.colorName).filter(Boolean)));
    const sizesList = Array.from(new Set(g.variants.map((v) => v.sizeName).filter(Boolean)));
    setEditColorsInput(colorsList.join(", "));
    setEditSizesInput(sizesList.join(", "));
    setEditManufacturerId(g.manufacturer?.id || "");
    setEditUnit(g.variants[0]?.unit || "Cái");
    setEditCostPrice(String(g.variants[0]?.costPrice || 0));
    setEditSellingPrice(String(g.variants[0]?.sellingPrice || 0));
    setEditImageUrl(g.imageUrl || "");
    setEditDescription(g.variants[0]?.description || "");
  };

  const openVariantEdit = (v: Product) => {
    setEditingVariant(v);
    setEditName(v.name);
    setEditBrandName(v.brandName || "");
    setEditColorName(v.colorName || "");
    setEditSizeName(v.sizeName || "");
    setEditUnit(v.unit || "Cái");
    setEditCostPrice(String(v.costPrice));
    setEditSellingPrice(String(v.sellingPrice));
    setEditImageUrl(v.imageUrl || "");
    setEditDescription(v.description || "");
  };

  const handleSaveGroupEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    setIsEditSubmitting(true);
    try {
      const res = await fetch("/api/products/batch-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: editingGroup.category.id,
          subcategoryId: editingGroup.subcategory.id,
          itemCode: editingGroup.itemCode,
          colorCode: editingGroup.colorCode || undefined,
          name: editName,
          brandName: editBrandName,
          unit: editUnit,
          costPrice: parseFloat(editCostPrice) || 0,
          sellingPrice: parseFloat(editSellingPrice) || 0,
          imageUrl: editImageUrl,
          description: editDescription,
          colorsInput: editColorsInput,
          sizesInput: editSizesInput,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Cập nhật thất bại");

      notify({ tone: "success", title: "Thành công", body: `Đã cập nhật cụm sản phẩm "${editName}" (Mã gốc: ${editingGroup.baseSku})` });
      setEditingGroup(null);
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleSaveVariantEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariant) return;

    setIsEditSubmitting(true);
    try {
      const res = await fetch(`/api/products/${editingVariant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          brandName: editBrandName,
          colorName: editColorName,
          sizeName: editSizeName,
          unit: editUnit,
          costPrice: parseFloat(editCostPrice) || 0,
          sellingPrice: parseFloat(editSellingPrice) || 0,
          imageUrl: editImageUrl,
          description: editDescription,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Cập nhật thất bại");

      notify({ tone: "success", title: "Thành công", body: `Đã cập nhật biến thể SKU "${result.sku}"` });
      setEditingVariant(null);
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCatId !== "ALL" && p.category.id !== selectedCatId) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchBarcode = p.barcode.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchBarcode) return false;
      }
      return true;
    });
  }, [products, selectedCatId, search]);

  const [groupImages, setGroupImages] = useState<Record<string, string>>({});

  const groupedProducts = useMemo(() => {
    const groupsMap = new Map<string, GroupItemType>();
    for (const p of filteredProducts) {
      // Group by 6-character prefix: [Cat(1)][Subcat(1)][ItemCode(2)][ColorCode(2)]
      const skuClean = (p.sku || "").trim().toUpperCase();
      const sku6Prefix = skuClean.length >= 6
        ? skuClean.slice(0, 6)
        : `${p.category.codeLetter}${p.subcategory.codeLetter}${(p.itemCode || "01").padStart(2, "0")}${(p.colorCode || "00").padStart(2, "0")}`;

      const key = `${p.category.id}_${p.subcategory.id}_${p.itemCode || "01"}_${p.colorCode || p.colorName || "default"}`;
      let group = groupsMap.get(key);

      if (!group) {
        group = {
          key,
          name: p.name,
          category: p.category,
          subcategory: p.subcategory,
          manufacturer: p.manufacturer,
          itemCode: p.itemCode || "01",
          colorName: p.colorName || null,
          colorCode: p.colorCode || null,
          baseSku: sku6Prefix,
          imageUrl: p.imageUrl,
          variants: [],
          colors: [],
          sizes: [],
          minPrice: p.sellingPrice,
          maxPrice: p.sellingPrice,
        };
        groupsMap.set(key, group);
      }

      group.variants.push(p);
      if (p.imageUrl && !group.imageUrl) group.imageUrl = p.imageUrl;
      if (p.colorName && !group.colors.includes(p.colorName)) group.colors.push(p.colorName);
      if (p.sizeName && !group.sizes.includes(p.sizeName)) group.sizes.push(p.sizeName);
      if (p.sellingPrice < group.minPrice) group.minPrice = p.sellingPrice;
      if (p.sellingPrice > group.maxPrice) group.maxPrice = p.sellingPrice;
    }
    return Array.from(groupsMap.values());
  }, [filteredProducts]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* SUB-TAB 1: NHẬP HÀNG (QUẢN LÝ ĐẶT XƯỞNG, QC, IN TEM LÔ & CẢNH BÁO TRỄ HẠN)*/}
      {/* ========================================================================= */}
      {activeSubTab === "import" && (
        <div className="space-y-6">
          {/* OVERDUE ALERT BANNER */}
          {overdueOrders.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 flex items-center justify-between shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center font-bold">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-rose-800 dark:text-rose-200">Cảnh báo: Có {overdueOrders.length} đơn hàng NSX đã quá hạn giao!</h4>
                  <p className="text-xs text-rose-600 dark:text-rose-300 mt-0.5">
                    Các nhà sản xuất chưa hoàn thành hoặc chưa giao đủ hàng theo thời hạn cam kết. Vui lòng liên hệ hối NSX.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setPoStatusFilter("OVERDUE")}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0"
              >
                Xem danh sách quá hạn
              </Button>
            </div>
          )}

          {/* Stat Cards for Factory Orders & QC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Tổng đơn đặt NSX</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{factoryOrders.length}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-[#2A2A2A] text-slate-800 dark:text-white flex items-center justify-center font-bold">
                  <Truck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Đang sản xuất</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {factoryOrders.filter((o) => o.status === "IN_PRODUCTION").length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">⚠️ Quá hạn hối NSX</p>
                  <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{overdueOrders.length}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Đã QC & Nhập kho</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {factoryOrders.filter((o) => o.status === "COMPLETED" || o.status === "PARTIAL_RETURN").length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter & Action Toolbar */}
          <Card className="border-none shadow-sm bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  placeholder="Tìm theo mã PO, Mã Lô Hàng, tên NSX, tên sản phẩm..."
                  className="pl-9 bg-slate-50/50 dark:bg-[#202024] border-slate-200 dark:border-neutral-700/80 dark:text-white dark:placeholder-neutral-400"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMfrListModal(true)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-[#222226] dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 shrink-0 font-semibold shadow-sm"
                >
                  <Building2 className="h-4 w-4 mr-1.5 text-slate-800 dark:text-slate-200" /> Quản lý NSX ({manufacturers.length})
                </Button>

                <Select
                  value={poStatusFilter}
                  onChange={(e) => setPoStatusFilter(e.target.value)}
                  className="min-w-[195px]"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="IN_PRODUCTION">Đang sản xuất</option>
                  <option value="QC_INSPECTION">Đang QC kiểm hàng</option>
                  <option value="OVERDUE">⚠️ Quá hạn giao hàng</option>
                  <option value="PARTIAL_RETURN">Có hàng hư trả NSX</option>
                  <option value="COMPLETED">Đã nhập kho xong</option>
                </Select>

                {canEdit && (
                  <Button
                    onClick={() => setShowAddPoModal(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 shrink-0 shadow-sm font-bold"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Tạo đơn đặt NSX
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Table List of Factory Orders */}
          <Card className="border-none shadow-sm overflow-hidden bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
            <CardHeader className="bg-slate-50/50 dark:bg-[#202024] border-b dark:border-neutral-800 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Danh sách Đơn đặt NSX & Lô hàng sản xuất ({filteredFactoryOrders.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b dark:border-neutral-800 bg-slate-50/50 dark:bg-[#222226] text-slate-500 dark:text-neutral-200 font-bold text-xs uppercase tracking-wider">
                      <th className="px-6 py-3.5">Mã Lô Hàng / PO</th>
                      <th className="px-6 py-3.5">Nhà sản xuất (NSX)</th>
                      <th className="px-6 py-3.5">Sản phẩm / SKU</th>
                      <th className="px-6 py-3.5 text-center">Số lượng đặt</th>
                      <th className="px-6 py-3.5 text-center">Kết quả QC Pass</th>
                      <th className="px-6 py-3.5 text-center">Trạng thái & Tem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {filteredFactoryOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-neutral-400">
                          Không tìm thấy đơn đặt hàng NSX phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredFactoryOrders.map((o) => {
                        const isPoOverdue = o.status !== "COMPLETED" && o.status !== "PARTIAL_RETURN" && !!o.expectedDate && o.expectedDate < todayStr;
                        const passRate = o.orderQuantity > 0 && o.qcPassedQuantity !== undefined
                          ? (((o.qcPassedQuantity || 0) / o.orderQuantity) * 100).toFixed(1)
                          : "0.0";

                        return (
                          <tr
                            key={o.id}
                            onClick={() => openBatchDetailModal(o)}
                            className={`hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer select-none group ${isPoOverdue ? "bg-rose-50/30 dark:bg-rose-950/20" : ""}`}
                            title="Click để xem chi tiết lô hàng"
                          >
                            <td className="px-6 py-4">
                              <div className="font-mono font-bold text-indigo-600 dark:text-indigo-300 group-hover:text-indigo-800 dark:group-hover:text-indigo-200 text-sm flex items-center gap-1.5 font-semibold">
                                <Tag className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                {o.batchCode || o.code}
                              </div>
                              <div className="text-xs text-slate-400 dark:text-neutral-400 mt-1 flex items-center gap-2">
                                <span>OD: {o.orderDate}</span>
                                {o.receivedDate && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">• RC: {o.receivedDate}</span>}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Factory className="h-4 w-4 text-indigo-500 dark:text-indigo-400" /> {o.manufacturerName}
                              </div>
                              <div className="text-xs text-slate-400 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
                                Hẹn giao: <span className={isPoOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-600 dark:text-neutral-300"}>{o.expectedDate}</span>
                                {isPoOverdue && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold animate-pulse">
                                    ⚠️ Trễ hẹn
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              {o.items && o.items.length > 1 ? (
                                <span className="inline-flex items-center text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-800/60 shadow-sm">
                                  📦 {o.items.length} mặt hàng / biến thể
                                </span>
                              ) : (
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">{o.productName}</div>
                                  {(o.items?.[0]?.sku || o.sku) && (
                                    <div className="text-xs font-mono text-slate-500 dark:text-neutral-400 mt-0.5">
                                      SKU: {o.items?.[0]?.sku || o.sku}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4 text-center">
                              <span className="font-mono font-bold text-slate-900 dark:text-white text-base">{o.orderQuantity.toLocaleString()}</span>
                              <span className="text-xs text-slate-500 dark:text-neutral-400 ml-1">cái</span>
                            </td>

                            <td className="px-6 py-4 text-center">
                              {o.status === "IN_PRODUCTION" || o.qcPassedQuantity === undefined ? (
                                <span className="text-xs text-slate-400 dark:text-neutral-400 italic">
                                  {o.status === "IN_PRODUCTION" ? "Đang cắt may..." : "Chờ QC kiểm hàng..."}
                                </span>
                              ) : (
                                <div>
                                  <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                                    {(o.qcPassedQuantity || 0).toLocaleString()} / {o.orderQuantity.toLocaleString()}
                                  </div>
                                  <div className="text-xs font-semibold text-slate-500 dark:text-neutral-400">({passRate}% Đạt)</div>
                                  {(o.qcFailedQuantity || 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openReturnDefectModal(o);
                                      }}
                                      className="text-[11px] text-rose-600 dark:text-rose-400 font-bold underline hover:text-rose-800 dark:hover:text-rose-300 mt-0.5 block mx-auto"
                                    >
                                      {o.qcFailedQuantity} cái lỗi (Trả NSX)
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4 text-center space-y-1">
                              {o.status === "IN_PRODUCTION" && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/60 font-semibold">Đang sản xuất</Badge>
                              )}
                              {o.status === "QC_INSPECTION" && (
                                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/60 font-semibold">Đang QC kiểm hàng</Badge>
                              )}
                              {o.status === "COMPLETED" && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold">Đã nhập kho</Badge>
                              )}
                              {o.status === "PARTIAL_RETURN" && (
                                <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/60 font-semibold">Có hàng lỗi trả NSX</Badge>
                              )}

                              {o.status !== "COMPLETED" && o.status !== "PARTIAL_RETURN" && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openBatchLabelModal(o);
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60 transition-all"
                                    title="In tem barcode lô hàng (Mặc định 3.5cm x 2.5cm)"
                                  >
                                    <Barcode className="h-3 w-3" />
                                    <span>In tem lô (3.5x2.5cm)</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: SẢN PHẨM (QUẢN LÝ DANH MỤC, SKU BIẾN THỂ & GIÁ BÁN)            */}
      {/* ========================================================================= */}
      {activeSubTab === "products" && (
        <div className="space-y-6">
          {/* Search & Filter Toolbar */}
          <Card className="border-none shadow-sm bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên sản phẩm, mã SKU..."
                  className="pl-9 bg-slate-50/50 dark:bg-[#202024] border-slate-200 dark:border-neutral-700/80 dark:text-white dark:placeholder-neutral-400"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <Select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="min-w-[180px]"
                >
                  <option value="ALL">Tất cả loại hàng</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.codeLetter})
                    </option>
                  ))}
                </Select>

                {canEdit && (
                  <Button
                    onClick={() => {
                      resetProductForm();
                      setShowAddModal(true);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm shrink-0 font-bold"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Thêm sản phẩm mới
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Table List of Products grouped */}
          <Card className="border-none shadow-sm overflow-hidden bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
            <CardHeader className="bg-slate-50/50 dark:bg-[#202024] border-b dark:border-neutral-800 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Danh sách Dòng sản phẩm & Biến thể SKU ({groupedProducts.length} dòng sản phẩm)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b dark:border-neutral-800 bg-slate-50/50 dark:bg-[#222226] text-slate-500 dark:text-neutral-200 font-bold text-xs uppercase tracking-wider">
                      <th className="px-6 py-3.5">Dòng Sản Phẩm</th>
                      <th className="px-6 py-3.5">Mã Gốc</th>
                      <th className="px-6 py-3.5">Biến thể</th>
                      <th className="px-6 py-3.5">Loại & Chủng loại</th>
                      <th className="px-6 py-3.5 text-right">Giá nhập</th>
                      <th className="px-6 py-3.5 text-right">Giá bán</th>
                      <th className="px-6 py-3.5 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {groupedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-neutral-400">
                          Chưa có sản phẩm nào trong hệ thống. Nhấn "Thêm sản phẩm mới" để bắt đầu.
                        </td>
                      </tr>
                    ) : (
                      groupedProducts.map((g) => {
                        const isExpanded = !!expandedGroups[g.key];
                        const vCount = g.variants.length;

                        return (
                          <Fragment key={g.key}>
                            <tr
                              onClick={() => toggleGroup(g.key)}
                              className="hover:bg-indigo-50/40 dark:hover:bg-white/5 transition-colors cursor-pointer select-none group"
                            >
                              <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                <div className="flex items-center gap-3">
                                  {/* Product Thumbnail & Hover Upload Button */}
                                  {(() => {
                                    const displayImg = groupImages[g.key] || g.imageUrl || g.variants.find((v) => v.imageUrl)?.imageUrl;
                                    return (
                                      <div className="relative group/img shrink-0">
                                        {displayImg ? (
                                          <img
                                            src={displayImg}
                                            alt={g.name}
                                            className="w-[58px] h-[58px] rounded-xl object-cover border border-slate-200 dark:border-neutral-700 shadow-sm bg-white dark:bg-[#202024]"
                                          />
                                        ) : (
                                          <div className="w-[58px] h-[58px] rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-[#202024] flex flex-col items-center justify-center text-slate-400 dark:text-neutral-500 gap-0.5">
                                            <ImageIcon className="h-5 w-5 text-slate-400 dark:text-neutral-500" />
                                            <span className="text-[9px] font-bold uppercase">Ảnh</span>
                                          </div>
                                        )}
                                        <label
                                          onClick={(e) => e.stopPropagation()}
                                          className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white"
                                          title="Click để tải/thay ảnh minh họa cho dòng SKU này"
                                        >
                                          <Camera className="h-4 w-4" />
                                          <span className="text-[9px] font-medium mt-0.5">Đổi ảnh</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                  if (ev.target?.result) {
                                                    setGroupImages((prev) => ({ ...prev, [g.key]: ev.target!.result as string }));
                                                  }
                                                };
                                                reader.readAsDataURL(file);
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                    );
                                  })()}

                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2 flex-wrap">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-slate-400 dark:text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 transition-transform" />
                                      )}
                                      <span className="truncate">{g.name}</span>
                                      {g.colorName && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#28282C] border border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-neutral-100 text-xs font-semibold">
                                          Màu: {g.colorName} {g.colorCode ? `(${g.colorCode})` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-neutral-400 font-normal flex items-center gap-1.5 mt-0.5 pl-6">
                                      {g.sizes.length > 0 && <span>{g.sizes.length} size ({g.sizes.join(", ")})</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-300">
                                {g.baseSku}xx
                              </td>

                              <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-100 dark:border-indigo-800/60">
                                  <Package className="h-3.5 w-3.5" />
                                  {vCount} biến thể
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 ml-0.5" /> : <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-neutral-200 w-fit">
                                    {g.category.name}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-neutral-400 pl-1">{g.subcategory.name}</span>
                                </div>
                              </td>

                              <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-neutral-300">
                                {g.variants[0]?.costPrice.toLocaleString("vi-VN")} đ
                              </td>

                              <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {g.minPrice === g.maxPrice
                                  ? `${g.minPrice.toLocaleString("vi-VN")} đ`
                                  : `${g.minPrice.toLocaleString("vi-VN")} - ${g.maxPrice.toLocaleString("vi-VN")} đ`}
                              </td>

                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {canEdit && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openGroupEdit(g);
                                        }}
                                        className="h-7 px-3 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-neutral-700 bg-transparent dark:bg-[#242428] hover:bg-indigo-50 dark:hover:bg-[#2C2C32] text-xs font-semibold"
                                      >
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Sửa SKU
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const groupTitle = g.colorName ? `${g.name} - Màu ${g.colorName}` : g.name;
                                          const ok = await confirm({
                                            title: `Xác nhận xóa cụm sản phẩm?`,
                                            description: `Bạn có chắc muốn xóa vĩnh viễn cụm sản phẩm "${groupTitle}" (Mã gốc: ${g.baseSku}xx) cùng toàn bộ ${g.variants.length} biến thể size của màu này?`,
                                            confirmLabel: "Xóa toàn bộ",
                                            cancelLabel: "Hủy",
                                            tone: "destructive",
                                          });
                                          if (ok) {
                                            try {
                                              const res = await fetch("/api/products/batch-update", {
                                                method: "DELETE",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                  categoryId: g.category.id,
                                                  subcategoryId: g.subcategory.id,
                                                  itemCode: g.itemCode,
                                                  colorCode: g.colorCode || undefined,
                                                }),
                                              });
                                              const resJson = await res.json();
                                              if (!res.ok) throw new Error(resJson.error || "Lỗi xóa cụm sản phẩm");
                                              notify({ tone: "success", title: "Đã xóa", body: `Đã xóa cụm sản phẩm "${groupTitle}" (${g.variants.length} biến thể)` });
                                              mutate();
                                            } catch (err: any) {
                                              notify({ tone: "error", title: "Lỗi", body: err.message });
                                            }
                                          }
                                        }}
                                        className="h-7 px-2.5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-neutral-700 bg-transparent dark:bg-[#242428] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Sub-table for SKU Variants */}
                            {isExpanded && (
                              <tr className="bg-slate-50/60 dark:bg-[#121214] border-b dark:border-neutral-800">
                                <td colSpan={8} className="p-4 pl-12">
                                  <div className="bg-white dark:bg-[#1C1C20] rounded-xl border border-slate-200 dark:border-neutral-700 shadow-sm p-4 space-y-3">
                                    <div className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider flex items-center justify-between">
                                      <span>Chi tiết biến thể SKU ({vCount} biến thể của {g.name})</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs text-left">
                                        <thead>
                                          <tr className="border-b dark:border-neutral-700 bg-slate-100/70 dark:bg-[#26262B] text-slate-600 dark:text-neutral-200 font-bold uppercase">
                                            <th className="px-3 py-2">STT</th>
                                            <th className="px-3 py-2">Màu sắc</th>
                                            <th className="px-3 py-2">Size</th>
                                            <th className="px-3 py-2">Mã SKU chính xác</th>
                                            <th className="px-3 py-2 text-right">Giá nhập</th>
                                            <th className="px-3 py-2 text-right">Giá bán</th>
                                            <th className="px-3 py-2 text-center">Thao tác</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                                          {g.variants.map((v, idx) => (
                                            <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                              <td className="px-3 py-2.5 text-slate-400 dark:text-neutral-500 font-mono">{idx + 1}</td>
                                              <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-neutral-200">
                                                {v.colorName ? (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 font-semibold">
                                                    {v.colorName} ({v.colorCode})
                                                  </span>
                                                ) : ("—")}
                                              </td>
                                              <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-neutral-200">
                                                {v.sizeName ? (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                                                    {v.sizeName} ({v.sizeCode})
                                                  </span>
                                                ) : ("—")}
                                              </td>
                                              <td className="px-3 py-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-300">
                                                {v.sku}
                                              </td>
                                              <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-neutral-300">
                                                {v.costPrice.toLocaleString("vi-VN")} đ
                                              </td>
                                              <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                {v.sellingPrice.toLocaleString("vi-VN")} đ
                                              </td>
                                              <td className="px-3 py-2.5 text-center">
                                                {canEdit && (
                                                  <div className="flex items-center justify-center gap-1">
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => openVariantEdit(v)}
                                                      className="h-7 w-7 p-0 text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-neutral-800"
                                                      title="Sửa biến thể"
                                                    >
                                                      <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={async () => {
                                                        const ok = window.confirm(
                                                          "Xóa biến thể SKU \"" + v.sku + "\"?\n\n" +
                                                          "Bạn có chắc muốn xóa biến thể SKU \"" + v.sku + "\" (" + (v.colorName || "Không màu") + " - Size " + (v.sizeName || "—") + ")?"
                                                        );
                                                        if (ok) {
                                                          try {
                                                           const res = await fetch("/api/products/" + v.id, { method: "DELETE" });
                                                           if (!res.ok) throw new Error("Lỗi xóa biến thể");
                                                           notify({ tone: "success", title: "Đã xóa", body: "Đã xóa biến thể SKU \"" + v.sku + "\"" });
                                                           mutate();
                                                          } catch (err: any) {
                                                           notify({ tone: "error", title: "Lỗi", body: err.message });
                                                          }
                                                        }
                                                      }}
                                                      className="h-7 w-7 p-0 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                                      title="Xóa biến thể SKU này"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </div>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: TỒN KHO (TRA CỨU SỐ LƯỢNG & QUÉT BARCODE XEM CHI TIẾT LÔ HÀNG)  */}
      {/* ========================================================================= */}
      {activeSubTab === "inventory" && (
        <div className="space-y-6">
          {/* BARCODE SCANNER / LOOKUP BANNER */}
          <Card className="border-none shadow-md bg-gradient-to-r from-slate-900 to-indigo-950 text-white overflow-hidden relative">
            <CardContent className="p-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold flex items-center gap-2 text-indigo-300">
                  <SearchCode className="h-6 w-6 text-indigo-400" />
                  Tra cứu Quét Mã Vạch Lô Hàng & Nhà Sản Xuất
                </h3>
                <p className="text-xs text-slate-300">
                  Quét mã vạch EAN-8 hoặc nhập Mã SKU/Lô hàng để xem chi tiết Nhà sản xuất, Ngày đặt & Lịch sử đợt hàng nhập tồn kho.
                </p>
              </div>

              <div className="relative w-full md:w-96">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />
                <Input
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Quét mã vạch hoặc nhập SKU..."
                  className="pl-10 pr-4 py-2.5 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20 rounded-xl"
                  autoFocus
                />
              </div>
            </CardContent>
          </Card>

          {/* Table List of Inventory Stock */}
          <Card className="border-none shadow-sm overflow-hidden bg-white/80 dark:bg-[#18181B] dark:border-neutral-800 backdrop-blur-sm">
            <CardHeader className="bg-slate-50/50 dark:bg-[#202024] border-b dark:border-neutral-800 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Chi tiết Tồn kho theo Dòng sản phẩm ({groupedInventoryProducts.length} dòng sản phẩm • {filteredInventoryProducts.length} biến thể)
              </CardTitle>

              <Select
                value={inventoryStockFilter}
                onChange={(e) => setInventoryStockFilter(e.target.value as any)}
                className="w-48 text-xs"
              >
                <option value="ALL">Tất cả mức tồn kho</option>
                <option value="IN_STOCK">Còn hàng (&gt; 5)</option>
                <option value="LOW_STOCK">⚠️ Sắp hết hàng (≤ 5)</option>
                <option value="OUT_OF_STOCK">Hết hàng (0)</option>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b dark:border-neutral-800 bg-slate-50/50 dark:bg-[#222226] text-slate-500 dark:text-neutral-200 font-bold text-xs uppercase tracking-wider">
                      <th className="px-4 py-3">Dòng Sản phẩm</th>
                      <th className="px-4 py-3">Mã gốc (SKU)</th>
                      <th className="px-4 py-3 text-center">Biến thể</th>
                      <th className="px-4 py-3 text-right">Khoảng giá bán</th>
                      <th className="px-4 py-3 text-center">Tổng tồn kho</th>
                      <th className="px-4 py-3 text-center">Sắp về hàng</th>
                      <th className="px-4 py-3 text-center">Trạng thái kho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {groupedInventoryProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-neutral-400">
                          Không tìm thấy sản phẩm nào trong kho.
                        </td>
                      </tr>
                    ) : (
                      groupedInventoryProducts.map((g) => {
                        const isExpanded = !!expandedInventoryGroups[g.key];
                        const vCount = g.variants.length;

                        return (
                          <Fragment key={g.key}>
                            <tr
                              onClick={() => toggleInventoryGroup(g.key)}
                              className="hover:bg-indigo-50/40 dark:hover:bg-white/5 transition-colors cursor-pointer select-none group"
                            >
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                <div className="flex items-center gap-3">
                                  {/* Product Thumbnail */}
                                  {(() => {
                                    const displayImg = groupImages[g.key] || g.imageUrl || g.variants.find((v) => v.imageUrl)?.imageUrl;
                                    return displayImg ? (
                                      <img
                                        src={displayImg}
                                        alt={g.name}
                                        className="w-[50px] h-[50px] rounded-xl object-cover border border-slate-200 dark:border-neutral-700 shadow-sm bg-white dark:bg-[#202024] shrink-0"
                                      />
                                    ) : (
                                      <div className="w-[50px] h-[50px] rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-[#202024] flex flex-col items-center justify-center text-slate-400 dark:text-neutral-500 gap-0.5 shrink-0">
                                        <ImageIcon className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                                        <span className="text-[8px] font-bold uppercase">Ảnh</span>
                                      </div>
                                    );
                                  })()}

                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-slate-400 dark:text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 transition-transform" />
                                      )}
                                      <span className="truncate">{g.name}</span>
                                      {g.colorName && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#28282C] border border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-neutral-100 text-xs font-semibold">
                                          Màu: {g.colorName} {g.colorCode ? `(${g.colorCode})` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-neutral-400 font-normal flex items-center gap-1.5 mt-0.5 pl-6">
                                      <span>{g.category.name} • {g.subcategory.name}</span>
                                      {g.sizes.length > 0 && <span>• {g.sizes.length} size ({g.sizes.join(", ")})</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-300 text-xs">
                                {g.baseSku}xx
                              </td>

                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-100 dark:border-indigo-800/60">
                                  <Package className="h-3.5 w-3.5" />
                                  {vCount} biến thể
                                </span>
                              </td>

                              <td className="px-4 py-3 text-right">
                                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/60 whitespace-nowrap">
                                  {g.minPrice === g.maxPrice
                                    ? `${g.minPrice.toLocaleString("vi-VN")}đ`
                                    : `${g.minPrice.toLocaleString("vi-VN")}đ - ${g.maxPrice.toLocaleString("vi-VN")}đ`}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-center">
                                <span className="font-mono font-bold text-base text-slate-900 dark:text-white">{g.totalQuantity.toLocaleString()}</span>
                                <span className="text-xs text-slate-500 dark:text-neutral-400 ml-1">cái</span>
                              </td>

                              <td className="px-4 py-3 text-center">
                                {g.totalIncomingQuantity > 0 ? (
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/60">
                                    <Truck className="h-3 w-3" />
                                    +{g.totalIncomingQuantity.toLocaleString()} cái
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-neutral-500 text-xs">0</span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-center">
                                {g.totalQuantity === 0 ? (
                                  <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/60 text-[11px] px-2.5 py-0.5 font-semibold">Hết hàng</Badge>
                                ) : g.hasLowStock ? (
                                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/60 text-[11px] px-2.5 py-0.5 font-semibold">⚠️ Có mẫu tồn thấp (≤5)</Badge>
                                ) : (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60 text-[11px] px-2.5 py-0.5 font-semibold">An toàn</Badge>
                                )}
                              </td>
                            </tr>

                            {/* Sub-table for SKU Variants in Inventory */}
                            {isExpanded && (
                              <tr className="bg-slate-50/60 dark:bg-[#121214] border-b dark:border-neutral-800">
                                <td colSpan={7} className="p-3 pl-10">
                                  <div className="bg-white dark:bg-[#1C1C20] rounded-xl border border-slate-200 dark:border-neutral-700 shadow-sm p-3 space-y-2">
                                    <div className="text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider flex items-center justify-between">
                                      <span>Biến thể chi tiết ({vCount} size của {g.name}{g.colorName ? ` - Màu ${g.colorName}` : ""})</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs text-left">
                                        <thead>
                                          <tr className="border-b dark:border-neutral-700 bg-slate-100/70 dark:bg-[#26262B] text-slate-600 dark:text-neutral-200 font-bold uppercase">
                                            <th className="px-3 py-2">STT</th>
                                            <th className="px-3 py-2">Mã SKU / Barcode</th>
                                            <th className="px-3 py-2">Màu sắc</th>
                                            <th className="px-3 py-2">Size</th>
                                            <th className="px-3 py-2">Nhà sản xuất (NSX)</th>
                                            <th className="px-3 py-2 text-right">Giá bán</th>
                                            <th className="px-3 py-2 text-center">Tồn kho</th>
                                            <th className="px-3 py-2 text-center">Sắp về hàng</th>
                                            <th className="px-3 py-2 text-center">Trạng thái</th>
                                            <th className="px-3 py-2 text-center">Thao tác</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                                          {g.variants.map((v, idx) => {
                                            const qty = v.quantity || 0;
                                            const vIncoming = v.incomingQuantity || 0;
                                            const matchingBatches = factoryOrders.filter((o) => {
                                              if (o.items && o.items.length > 0) {
                                                return o.items.some((item) => {
                                                  if (v.sku && item.sku) return item.sku.trim().toLowerCase() === v.sku.trim().toLowerCase();
                                                  if (item.productName && v.name) {
                                                    return (
                                                      item.productName.trim().toLowerCase() === v.name.trim().toLowerCase() &&
                                                      (!item.colorName || !v.colorName || item.colorName.trim().toLowerCase() === v.colorName.trim().toLowerCase()) &&
                                                      (!item.sizeName || !v.sizeName || item.sizeName.trim().toLowerCase() === v.sizeName.trim().toLowerCase())
                                                    );
                                                  }
                                                  return false;
                                                });
                                              }
                                              if (v.sku && o.sku) return o.sku.trim().toLowerCase() === v.sku.trim().toLowerCase();
                                              return o.productName.trim().toLowerCase() === v.name.trim().toLowerCase();
                                            });

                                            return (
                                              <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                                <td className="px-3 py-2.5 text-slate-400 dark:text-neutral-500 font-mono">{idx + 1}</td>
                                                <td className="px-3 py-2.5">
                                                  <div className="font-mono font-bold text-indigo-600 dark:text-indigo-300">{v.sku}</div>
                                                  <div className="text-[11px] font-mono text-slate-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                                                    <Barcode className="h-3 w-3 text-indigo-400" /> {v.barcode}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-neutral-200">
                                                  {v.colorName ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 font-semibold">
                                                      {v.colorName} ({v.colorCode})
                                                    </span>
                                                  ) : ("—")}
                                                </td>
                                                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-neutral-200">
                                                  {v.sizeName ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                                                      {v.sizeName} ({v.sizeCode})
                                                    </span>
                                                  ) : ("—")}
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600 dark:text-neutral-300 text-xs">
                                                  {v.manufacturer ? (
                                                    <div>
                                                      <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1">
                                                        <Factory className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                                        {v.manufacturer.name}
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <span className="text-slate-400 dark:text-neutral-500">—</span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                  {v.sellingPrice ? `${v.sellingPrice.toLocaleString("vi-VN")}đ` : "—"}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                  <span className="font-mono font-bold text-slate-900 dark:text-white">{qty.toLocaleString()}</span>
                                                  <span className="text-slate-500 dark:text-neutral-400 ml-1">{v.unit}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                  {vIncoming > 0 ? (
                                                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300 text-xs">
                                                      +{vIncoming.toLocaleString()} cái
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-400 dark:text-neutral-500 text-xs">0</span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                  {qty > 5 && (
                                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60 text-[10px] px-2 py-0.5 font-semibold">An toàn</Badge>
                                                  )}
                                                  {qty <= 5 && qty > 0 && (
                                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/60 text-[10px] px-2 py-0.5 font-semibold">Sắp hết</Badge>
                                                  )}
                                                  {qty === 0 && (
                                                    <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/60 text-[10px] px-2 py-0.5 font-semibold">Hết hàng</Badge>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openInventoryLookup(v)}
                                                    className="border-indigo-200 dark:border-neutral-700 text-indigo-600 dark:text-indigo-300 bg-transparent dark:bg-[#242428] hover:bg-indigo-50 dark:hover:bg-[#2C2C32] text-[11px] font-semibold h-7 px-2"
                                                  >
                                                    <Eye className="h-3 w-3 mr-1" /> Chi tiết Lô ({matchingBatches.length})
                                                  </Button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TEM BARCODE LÔ HÀNG (SẢN XUẤT) CHUẨN MẶC ĐỊNH 3.5cm x 2.5cm        */}
      {/* ========================================================================= */}
      <BatchLabelPrintModal
        po={selectedPoForBatchLabel}
        isOpen={showBatchLabelModal}
        onClose={() => {
          setShowBatchLabelModal(false);
          setSelectedPoForBatchLabel(null);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: QC KIỂM ĐỊNH & TỰ ĐỘNG CẬP NHẬT TỒN KHO & IN TEM BÁN HÀNG        */}
      {/* ========================================================================= */}
      {showQcModal && selectedPo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-neutral-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  QC Kiểm Định & Nhập Kho Đợt Hàng
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Đơn: {selectedPo.code} • Mã Lô: {selectedPo.batchCode}
                </p>
              </div>
              <button onClick={() => setShowQcModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQc} className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 space-y-1 text-xs text-indigo-900 dark:text-indigo-200">
                <div className="font-bold flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300">
                  <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Thông tin đợt hàng:
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-medium">
                  <div>Sản phẩm: <b className="text-slate-900 dark:text-white">{selectedPo.productName}</b></div>
                  <div>Số lượng đặt: <b className="text-indigo-700 dark:text-indigo-300">{selectedPo.orderQuantity.toLocaleString()} cái</b></div>
                  <div>NSX: <b className="text-slate-900 dark:text-white">{selectedPo.manufacturerName}</b></div>
                  <div>Ngày hẹn trả: <b className="text-slate-900 dark:text-white">{selectedPo.expectedDate}</b></div>
                </div>
              </div>

              {/* Multi-Item / Variant QC Table */}
              {(() => {
                const totalPassedCount = qcItemStates.reduce((acc, i) => acc + (Number(i.passedQty) || 0), 0);
                const totalFailedCount = qcItemStates.reduce((acc, i) => acc + (Number(i.failedQty) || 0), 0);
                const totalOrderedCount = qcItemStates.reduce((acc, i) => acc + (Number(i.orderQuantity) || 0), 0);

                return (
                  <>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b dark:border-neutral-800 pb-2">
                        <label className="block text-xs font-bold text-slate-800 dark:text-neutral-200 uppercase tracking-wider">
                          Nhập SL QC Đạt & Lỗi Cho Từng Mặt Hàng / Biến Thể ({qcItemStates.length})
                        </label>
                        <div className="text-xs font-medium flex items-center gap-3">
                          <span className="text-slate-600 dark:text-neutral-300">Tổng đặt: <b className="text-slate-900 dark:text-white">{totalOrderedCount.toLocaleString()}</b></span>
                          <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                            ✅ Đạt: <b>{totalPassedCount.toLocaleString()}</b>
                          </span>
                          <span className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/60 font-semibold">
                            ❌ Lỗi: <b>{totalFailedCount.toLocaleString()}</b>
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#202024]">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-slate-50/80 dark:bg-[#26262B] border-b dark:border-neutral-700 text-slate-500 dark:text-neutral-200 font-bold uppercase text-[11px]">
                              <th className="px-3 py-2.5">Sản phẩm / SKU</th>
                              <th className="px-3 py-2.5">Màu / Size</th>
                              <th className="px-3 py-2.5 text-center">SL Đặt</th>
                              <th className="px-3 py-2.5 text-center w-32 text-emerald-700 dark:text-emerald-400">✅ SL Đạt QC</th>
                              <th className="px-3 py-2.5 text-center w-32 text-rose-700 dark:text-rose-400">❌ SL Lỗi (Trả NSX)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                            {qcItemStates.map((st, idx) => (
                              <tr key={st.itemId || idx} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                                <td className="px-3 py-2.5">
                                  <div className="font-bold text-slate-900 dark:text-white">{st.productName}</div>
                                  {st.sku && <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-300">SKU: {st.sku}</div>}
                                </td>
                                <td className="px-3 py-2.5">
                                  {(st.colorName || st.sizeName) ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-[#2C2C32] text-slate-700 dark:text-neutral-200 font-semibold text-[11px]">
                                      {st.colorName || ""}{st.colorName && st.sizeName ? " • " : ""}{st.sizeName || ""}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-neutral-500">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-neutral-100">
                                  {st.orderQuantity.toLocaleString()} cái
                                </td>
                                <td className="px-3 py-2.5">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={st.orderQuantity}
                                    value={st.passedQty}
                                    onChange={(e) => updateQcItemQty(st.itemId, "passed", e.target.value)}
                                    className="font-mono font-bold text-center border-emerald-300 dark:border-emerald-700 dark:bg-[#18181B] focus:border-emerald-500 text-emerald-700 dark:text-emerald-400 text-xs h-8 px-1.5"
                                  />
                                </td>
                                <td className="px-3 py-2.5">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={st.failedQty}
                                    onChange={(e) => updateQcItemQty(st.itemId, "failed", e.target.value)}
                                    className="font-mono font-bold text-center border-rose-300 dark:border-rose-700 dark:bg-[#18181B] focus:border-rose-500 text-rose-700 dark:text-rose-400 text-xs h-8 px-1.5"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 px-1">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Số lượng Đạt sẽ tự động cộng trực tiếp vào Tồn Kho từng SKU.</span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">✕ Số lượng Lỗi sẽ tự động tách thành Phiếu trả hàng NSX.</span>
                      </div>
                    </div>

                    {totalFailedCount > 0 && (
                      <div>
                        <label className="block text-sm font-bold text-rose-800 dark:text-rose-300 mb-1">
                          Ghi chú chi tiết lỗi sản phẩm (cho NSX kiểm tra & chỉnh sửa) *
                        </label>
                        <textarea
                          value={qcFailReasonNotes}
                          onChange={(e) => setQcFailReasonNotes(e.target.value)}
                          rows={3}
                          placeholder="VD: 5 áo Jacket M bị tuột đường may nách, 3 áo bị dính bẩn mỡ máy dệt, đề nghị may lại..."
                          className="w-full rounded-xl border border-rose-200 dark:border-rose-800/80 p-2.5 text-xs text-rose-900 dark:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-rose-50/40 dark:bg-rose-950/30"
                          required
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-1">Ghi chú QC chung</label>
                <Input
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  placeholder="Ghi chú thêm về lô hàng..."
                  className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t dark:border-neutral-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowQcModal(false)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                  Hủy
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Xác nhận QC & Nhập Tồn Kho
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PHIẾU HÀNG LỖI TRẢ NSX / BẢO HÀNH CHI TIẾT                       */}
      {/* ========================================================================= */}
      {showReturnDefectModal && selectedReturnPo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-neutral-800 pb-4">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <RotateCcw className="h-5 w-5" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Phiếu Trả Hàng NSX / Chỉnh Sửa</h3>
              </div>
              <button onClick={() => setShowReturnDefectModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 space-y-2">
                <div className="font-bold text-sm text-rose-800 dark:text-rose-200 flex items-center justify-between">
                  <span>Mã lô: {selectedReturnPo.batchCode}</span>
                  <Badge className="bg-rose-600 text-white font-bold">{selectedReturnPo.qcFailedQuantity} sản phẩm không đạt</Badge>
                </div>
                <div>Xưởng sản xuất: <b className="text-slate-900 dark:text-white">{selectedReturnPo.manufacturerName}</b></div>
                <div>Mẫu sản phẩm: <b className="text-slate-900 dark:text-white">{selectedReturnPo.productName}</b> (SKU: {selectedReturnPo.sku})</div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">Ghi chú lỗi kỹ thuật chi tiết để NSX khắc phục:</h4>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#202024] border border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-neutral-200 font-mono text-xs leading-relaxed">
                  {selectedReturnPo.failReasonNotes || selectedReturnPo.qcNotes || "Không có thông tin lỗi chi tiết."}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t dark:border-neutral-800 pt-4">
              <Button variant="outline" onClick={() => setShowReturnDefectModal(false)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                Đóng
              </Button>
              <Button
                onClick={() => {
                  window.print();
                  notify({ tone: "success", title: "In phiếu trả NSX", body: "Đã tạo phiếu trả hàng cho xưởng" });
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                <Printer className="h-4 w-4 mr-2" /> In Phiếu Trả Hàng NSX
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: TRA CỨU BARCODE & LỊCH SỬ LÔ HÀNG KHO (TAB TỒN KHO)              */}
      {/* ========================================================================= */}
      {showInventoryLookupDrawer && selectedInventoryProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <Barcode className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Thông Tin Chi Tiết Lô Hàng & NSX</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 font-mono">Mã SKU: {selectedInventoryProduct.sku} • Barcode: {selectedInventoryProduct.barcode}</p>
                </div>
              </div>
              <button onClick={() => setShowInventoryLookupDrawer(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Product & Manufacturer Header Info */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider block">Tên sản phẩm</span>
                  <h4 className="text-lg font-bold text-white">{selectedInventoryProduct.name}</h4>
                  <div className="text-xs text-slate-300 mt-1">
                    Phân loại: {selectedInventoryProduct.category.name} • {selectedInventoryProduct.colorName} / {selectedInventoryProduct.sizeName}
                  </div>
                </div>

                <div className="bg-white/10 p-3 rounded-xl border border-white/20 text-center shrink-0">
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">Tổng Tồn Kho</span>
                  <span className="text-2xl font-mono font-bold text-emerald-400">
                    {(selectedInventoryProduct.quantity || 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-300 ml-1">{selectedInventoryProduct.unit}</span>
                </div>
              </div>

              {/* Manufacturer Info Card */}
              {selectedInventoryProduct.manufacturer && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#202024] border border-slate-200 dark:border-neutral-700 text-xs space-y-1">
                  <div className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5 mb-1">
                    <Factory className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Nhà sản xuất: {selectedInventoryProduct.manufacturer.name}
                  </div>
                  <div>Mã NSX: <b className="text-slate-900 dark:text-white">{selectedInventoryProduct.manufacturer.code}</b></div>
                  {selectedInventoryProduct.manufacturer.phone && <div>Số điện thoại liên hệ: <b className="text-slate-900 dark:text-white">{selectedInventoryProduct.manufacturer.phone}</b></div>}
                  {selectedInventoryProduct.manufacturer.address && <div>Địa chỉ xưởng: <span className="text-slate-700 dark:text-neutral-300">{selectedInventoryProduct.manufacturer.address}</span></div>}
                </div>
              )}

              {/* Batch History Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Lịch sử Các Lô Hàng Sản Xuất Nhập Vào Kho:
                </h4>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-700">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-[#26262B] border-b dark:border-neutral-700 text-slate-600 dark:text-neutral-200 uppercase font-bold">
                        <th className="px-3 py-2.5">Mã Lô Hàng</th>
                        <th className="px-3 py-2.5">Ngày Đặt (OD)</th>
                        <th className="px-3 py-2.5">Ngày Nhập (RC)</th>
                        <th className="px-3 py-2.5 text-center">Số lượng nhập</th>
                        <th className="px-3 py-2.5 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {(() => {
                        const matchingBatchesList = factoryOrders.filter((o) => {
                          if (o.items && o.items.length > 0) {
                            return o.items.some((item) => {
                              if (selectedInventoryProduct.sku && item.sku) {
                                return item.sku.trim().toLowerCase() === selectedInventoryProduct.sku.trim().toLowerCase();
                              }
                              return (
                                item.productName.trim().toLowerCase() === selectedInventoryProduct.name.trim().toLowerCase() &&
                                (!item.colorName || !selectedInventoryProduct.colorName || item.colorName.trim().toLowerCase() === selectedInventoryProduct.colorName.trim().toLowerCase()) &&
                                (!item.sizeName || !selectedInventoryProduct.sizeName || item.sizeName.trim().toLowerCase() === selectedInventoryProduct.sizeName.trim().toLowerCase())
                              );
                            });
                          }
                          if (selectedInventoryProduct.sku && o.sku) {
                            return o.sku.trim().toLowerCase() === selectedInventoryProduct.sku.trim().toLowerCase();
                          }
                          return o.productName.trim().toLowerCase() === selectedInventoryProduct.name.trim().toLowerCase();
                        });

                        if (matchingBatchesList.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-neutral-400">
                                Chưa có dữ liệu lô hàng sản xuất cho sản phẩm này.
                              </td>
                            </tr>
                          );
                        }

                        return matchingBatchesList.map((batch) => (
                          <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                            <td className="px-3 py-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-300">{batch.batchCode}</td>
                            <td className="px-3 py-2.5 text-slate-600 dark:text-neutral-300">{batch.orderDate}</td>
                            <td className="px-3 py-2.5 text-emerald-700 dark:text-emerald-400 font-semibold">{batch.receivedDate || "Chờ QC"}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-white">{batch.qcPassedQuantity || batch.orderQuantity} cái</td>
                            <td className="px-3 py-2.5 text-center">
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold">Đã nhập kho</Badge>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end border-t dark:border-neutral-800 pt-4">
              <Button variant="outline" onClick={() => setShowInventoryLookupDrawer(false)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: TẠO PHIẾU ĐẶT XƯỞNG MỚI (NHIỀU SẢN PHẨM & BIẾN THỂ)             */}
      {/* ========================================================================= */}
      {showAddPoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-6 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-neutral-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Tạo phiếu đặt NSX (Đặt hàng xưởng)
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Đặt 1 lúc nhiều sản phẩm và các biến thể Màu / Size với số lượng riêng biệt.
                </p>
              </div>
              <button onClick={() => setShowAddPoModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-[#202024] p-4 rounded-xl border border-slate-200 dark:border-neutral-700">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300">Nhà sản xuất (NSX) *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMfr(null);
                        setMfrName("");
                        setMfrCode("");
                        setMfrAddress("");
                        setMfrPhone("");
                        setMfrTaxId("");
                        setShowMfrModal(true);
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      + Thêm mới
                    </button>
                  </div>
                  <Select
                    value={poMfrName}
                    onChange={(e) => setPoMfrName(e.target.value)}
                    required
                    className="bg-white dark:bg-[#18181B] text-xs"
                  >
                    <option value="">-- Chọn Nhà sản xuất --</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} (Mã: {m.code})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Ngày đặt hàng (OD)</label>
                  <Input
                    type="date"
                    value={poOrderDate}
                    onChange={(e) => setPoOrderDate(e.target.value)}
                    className="bg-white dark:bg-[#18181B] dark:border-neutral-700/80 dark:text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Ngày hẹn giao NSX *</label>
                  <Input
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                    required
                    className="bg-white dark:bg-[#18181B] dark:border-neutral-700/80 dark:text-white text-xs font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Table of Products / SKU Variants to Order */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-700 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Danh sách sản phẩm & biến thể đặt hàng ({poItems.length})
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPoItemRow}
                    className="border-indigo-200 dark:border-neutral-700 text-indigo-600 dark:text-indigo-300 bg-transparent dark:bg-[#242428] hover:bg-indigo-50 dark:hover:bg-[#2C2C32] text-xs font-bold h-8"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Thêm sản phẩm / biến thể
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-700">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-[#26262B] border-b dark:border-neutral-700 text-slate-600 dark:text-neutral-200 uppercase font-bold">
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Chọn Sản Phẩm / SKU</th>
                        <th className="px-3 py-2.5">Mã SKU</th>
                        <th className="px-3 py-2.5">Màu / Size</th>
                        <th className="px-3 py-2.5 w-32 text-center">Số lượng đặt</th>
                        <th className="px-3 py-2.5 w-12 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {poItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="px-3 py-2 text-slate-400 dark:text-neutral-500 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <Select
                              value={item.productId}
                              onChange={(e) => updatePoItemRow(item.id, "productId", e.target.value)}
                              className="text-xs bg-white dark:bg-[#18181B]"
                            >
                              <option value="">-- Chọn sản phẩm từ danh mục --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.colorName ? `• ${p.colorName}` : ""} {p.sizeName ? `(${p.sizeName})` : ""} [SKU: {p.sku}]
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-indigo-600 dark:text-indigo-300">
                            <Input
                              value={item.sku}
                              onChange={(e) => updatePoItemRow(item.id, "sku", e.target.value)}
                              placeholder="SKU"
                              className="text-xs font-mono h-8 dark:bg-[#18181B] dark:border-neutral-700/80 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="grid grid-cols-2 gap-1">
                              <Input
                                value={item.colorName}
                                onChange={(e) => updatePoItemRow(item.id, "colorName", e.target.value)}
                                placeholder="Màu sắc"
                                className="text-xs h-8 dark:bg-[#18181B] dark:border-neutral-700/80 dark:text-white"
                              />
                              <Input
                                value={item.sizeName}
                                onChange={(e) => updatePoItemRow(item.id, "sizeName", e.target.value)}
                                placeholder="Size"
                                className="text-xs h-8 dark:bg-[#18181B] dark:border-neutral-700/80 dark:text-white"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Input
                              type="number"
                              min={1}
                              value={item.orderQuantity}
                              onChange={(e) => updatePoItemRow(item.id, "orderQuantity", Number(e.target.value) || 0)}
                              className="text-xs font-mono font-bold text-center h-8 dark:bg-[#18181B] dark:border-neutral-700/80 dark:text-white"
                              required
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {poItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removePoItemRow(item.id)}
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">Ghi chú & Quy cách may của lô hàng</label>
                <Input
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Ví dụ: Đính nhãn mác đúng quy chuẩn, đóng nút inox chắc chắn..."
                  className="text-xs dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between border-t dark:border-neutral-800 pt-4">
                <div className="text-xs text-slate-600 dark:text-neutral-300 font-medium">
                  Tổng đặt: <strong className="text-indigo-700 dark:text-indigo-300 font-mono text-sm">{poItems.reduce((acc, i) => acc + (i.orderQuantity || 0), 0).toLocaleString()} cái</strong> ({poItems.length} mặt hàng)
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddPoModal(false)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                    Hủy
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    <Truck className="h-4 w-4 mr-2" /> Tạo đơn NSX & In Tem Lô
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CHI TIẾT LÔ HÀNG VÀ TẤT CẢ BIẾN THỂ TRONG PHIẾU ĐẶT NSX           */}
      {/* ========================================================================= */}
      {showBatchDetailModal && selectedPoForDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 w-full h-full min-h-screen bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBatchDetailModal(false)} />
          <div className="relative z-10 bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-6 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-neutral-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                    {selectedPoForDetail.batchCode}
                  </h3>
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/60 font-semibold">
                    PO: {selectedPoForDetail.code}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                  Nhà sản xuất: <strong className="text-slate-900 dark:text-white">{selectedPoForDetail.manufacturerName}</strong>
                </p>
              </div>
              <button onClick={() => setShowBatchDetailModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-[#202024] p-4 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs">
              <div>
                <span className="text-slate-500 dark:text-neutral-400 block">Ngày đặt hàng (OD):</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedPoForDetail.orderDate}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-neutral-400 block">Ngày hẹn giao:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedPoForDetail.expectedDate}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-neutral-400 block">Ngày nhập kho (RC):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedPoForDetail.receivedDate || "Đang sản xuất"}</span>
              </div>
            </div>

            {/* Table of items/variants in the order */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-700 dark:text-neutral-200 uppercase tracking-wider flex items-center justify-between">
                <span>Danh sách sản phẩm & biến thể trong lô ({selectedPoForDetail.items?.length || 1} mặt hàng)</span>
                <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold">Tổng đặt: {selectedPoForDetail.orderQuantity.toLocaleString()} cái</span>
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-700">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b dark:border-neutral-700 bg-slate-100/80 dark:bg-[#26262B] text-slate-600 dark:text-neutral-200 font-bold uppercase">
                      <th className="px-3 py-2.5">STT</th>
                      <th className="px-3 py-2.5">Tên sản phẩm</th>
                      <th className="px-3 py-2.5">Mã SKU</th>
                      <th className="px-3 py-2.5">Màu / Size</th>
                      <th className="px-3 py-2.5 text-center">Số lượng đặt</th>
                      <th className="px-3 py-2.5 text-center">QC Đạt</th>
                      <th className="px-3 py-2.5 text-center">QC Lỗi</th>
                      <th className="px-3 py-2.5 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {(selectedPoForDetail.items || [
                      {
                        id: "item-1",
                        productName: selectedPoForDetail.productName,
                        sku: selectedPoForDetail.sku || "SKU-AUTO",
                        orderQuantity: selectedPoForDetail.orderQuantity,
                        qcPassedQuantity: selectedPoForDetail.qcPassedQuantity,
                        qcFailedQuantity: selectedPoForDetail.qcFailedQuantity,
                      }
                    ]).map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="px-3 py-2.5 text-slate-400 dark:text-neutral-500 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{item.productName}</td>
                        <td className="px-3 py-2.5 font-mono text-indigo-600 dark:text-indigo-300 font-bold">{item.sku}</td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-neutral-300">
                          {item.colorName || item.sizeName ? `${item.colorName || ""} ${item.sizeName ? "• " + item.sizeName : ""}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900 dark:text-white">{item.orderQuantity.toLocaleString()} cái</td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{(item.qcPassedQuantity || 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-rose-600 dark:text-rose-400">{(item.qcFailedQuantity || 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center">
                          {selectedPoForDetail.status !== "COMPLETED" && selectedPoForDetail.status !== "PARTIAL_RETURN" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPoForBatchLabel({
                                  ...selectedPoForDetail,
                                  productName: item.productName,
                                  sku: item.sku,
                                  orderQuantity: item.orderQuantity,
                                  colorName: item.colorName,
                                  sizeName: item.sizeName,
                                });
                                setShowBatchLabelModal(true);
                              }}
                              className="border-indigo-200 dark:border-neutral-700 text-indigo-600 dark:text-indigo-300 bg-transparent dark:bg-[#242428] hover:bg-indigo-50 dark:hover:bg-[#2C2C32] text-[11px] font-semibold h-7 px-2"
                            >
                              <Barcode className="h-3 w-3 mr-1" /> In Tem Lô
                            </Button>
                          ) : (
                            <span className="text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedPoForDetail.qcNotes && (
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 rounded-xl text-xs space-y-1">
                <div className="font-bold text-indigo-900 dark:text-indigo-300">Ghi chú QC & Yêu cầu sản xuất:</div>
                <div className="text-slate-700 dark:text-neutral-200">{selectedPoForDetail.qcNotes}</div>
              </div>
            )}

            {selectedPoForDetail.failReasonNotes && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs space-y-1">
                <div className="font-bold text-rose-900 dark:text-rose-200">Ghi chú lỗi kỹ thuật (Trả NSX):</div>
                <div className="text-rose-800 dark:text-rose-300">{selectedPoForDetail.failReasonNotes}</div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t dark:border-neutral-800 pt-4">
              <div className="flex items-center gap-2">
                {selectedPoForDetail.status !== "COMPLETED" && selectedPoForDetail.status !== "PARTIAL_RETURN" && (
                  <Button
                    onClick={() => {
                      setSelectedPoForBatchLabel(selectedPoForDetail);
                      setShowBatchLabelModal(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  >
                    <Barcode className="h-4 w-4 mr-2" /> In Tem Tất Cả Lô Hàng
                  </Button>
                )}

                {canEdit && (
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteBatchOrder(selectedPoForDetail)}
                    className="border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 bg-transparent dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Xóa phiếu đặt
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowBatchDetailModal(false)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                  Đóng
                </Button>
                
                {selectedPoForDetail.status === "COMPLETED" ? (
                  <Button
                    disabled
                    className="bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700 font-bold cursor-not-allowed"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600 dark:text-emerald-400" /> Đã Nhập Kho (Đóng QC)
                  </Button>
                ) : selectedPoForDetail.status === "PARTIAL_RETURN" ? (
                  <Button
                    disabled
                    className="bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700 font-bold cursor-not-allowed"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5 text-amber-600 dark:text-amber-400" /> Đã QC & Tách Lô Trả NSX (Đóng QC)
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (selectedPoForDetail) {
                        openQcModal(selectedPoForDetail);
                        setShowBatchDetailModal(false);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    <ClipboardCheck className="h-4 w-4 mr-1.5" /> QC & Nhập Kho
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Product (Tab Sản phẩm) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-[#202024] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black shadow-md">
                  <Plus className="h-4 w-4 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Thêm sản phẩm mới</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Khai báo sản phẩm và tự động khởi tạo biến thể SKU</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleAddProduct} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-130px)]">
                {/* SKU Preview Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg space-y-2 border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Mã SKU Tự Động Sinh:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                      ✓ Duy nhất (Không trùng)
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-2xl tracking-wider text-amber-300">
                        {previewData.skuPreview}
                      </span>
                      <span className="text-xs text-slate-300 bg-white/10 px-2 py-0.5 rounded font-mono">
                        [{previewData.catLet} + {previewData.subcatLet} + {previewData.itemCode}]
                      </span>
                    </div>
                    {previewData.variantCount > 1 && (
                      <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full text-xs font-medium">
                        Tạo {previewData.variantCount} biến thể
                      </span>
                    )}
                  </div>
                </div>

                {/* General Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">
                      Tên sản phẩm *
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ví dụ: Áo thun Polo Nam"
                      className="h-10 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                      required
                    />
                  </div>

                  {/* Brand Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
                        Thương hiệu
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (brandMode === "SELECT") setBrandMode("ADD");
                          else setBrandMode("SELECT");
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        {brandMode === "SELECT" ? "+ Thêm" : "Hủy"}
                      </button>
                    </div>

                    {brandMode === "SELECT" && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenBrandDropdown(!openBrandDropdown)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#202024] text-sm font-medium flex items-center justify-between shadow-sm hover:border-slate-400 focus:ring-2 focus:ring-indigo-500 text-left"
                        >
                          <span className={brandName ? "text-slate-900 dark:text-white font-semibold truncate pr-2" : "text-slate-400 dark:text-neutral-400"}>
                            {brandName || "-- Chọn thương hiệu --"}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400 dark:text-neutral-400 shrink-0" />
                        </button>

                        {openBrandDropdown && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setOpenBrandDropdown(false)} />
                            <div className="absolute left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#1C1C20] shadow-xl py-1 z-30 divide-y divide-slate-50 dark:divide-neutral-800">
                              {brandsList.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-slate-400 dark:text-neutral-400 italic">Chưa có thương hiệu nào</div>
                              ) : (
                                brandsList.map((b) => (
                                  <div
                                    key={b}
                                    className={`group flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors ${
                                      brandName === b ? "bg-indigo-50/70 dark:bg-white/10 font-bold text-indigo-900 dark:text-indigo-300" : "text-slate-700 dark:text-neutral-200"
                                    }`}
                                    onClick={() => {
                                      setBrandName(b);
                                      setOpenBrandDropdown(false);
                                    }}
                                  >
                                    <span className="flex items-center gap-2 truncate pr-2">
                                      {brandName === b && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                      <span>{b}</span>
                                    </span>
                                    <div
                                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBrandName(b);
                                          setModalBrandEditName(b);
                                          setBrandMode("EDIT");
                                          setOpenBrandDropdown(false);
                                        }}
                                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-neutral-800 rounded"
                                        title="Sửa thương hiệu này"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Bạn có chắc muốn xóa thương hiệu "${b}" khỏi danh sách?`)) {
                                            setBrandsList(brandsList.filter((x) => x !== b));
                                            if (brandName === b) setBrandName("");
                                          }
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 rounded"
                                        title="Xóa thương hiệu này"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {brandMode === "ADD" && (
                      <div className="flex gap-2">
                        <Input
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          placeholder="Tên thương hiệu mới..."
                          className="h-10 text-sm flex-1 dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (brandName.trim() && !brandsList.includes(brandName.trim())) {
                              setBrandsList([...brandsList, brandName.trim()]);
                            }
                            setBrandMode("SELECT");
                          }}
                          className="h-10 text-xs px-3 bg-indigo-600 text-white font-bold"
                        >
                          Lưu
                        </Button>
                      </div>
                    )}

                    {brandMode === "EDIT" && (
                      <div className="flex gap-2">
                        <Input
                          value={modalBrandEditName}
                          onChange={(e) => setModalBrandEditName(e.target.value)}
                          placeholder="Sửa tên thương hiệu..."
                          className="h-10 text-sm flex-1 dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const trimmed = modalBrandEditName.trim();
                            if (trimmed) {
                              setBrandsList(brandsList.map((b) => (b === brandName ? trimmed : b)));
                              setBrandName(trimmed);
                            }
                            setBrandMode("SELECT");
                          }}
                          className="h-10 text-xs px-3 bg-amber-600 text-white font-bold"
                        >
                          Cập nhật
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Category & Material Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
                        Chủng loại sản phẩm *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (catMode === "SELECT") {
                            setCustomCatLetter(getRandomCapitalLetter());
                            setCatMode("ADD");
                          } else {
                            setCatMode("SELECT");
                          }
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        {catMode === "SELECT" ? "+ Thêm mới" : "Hủy"}
                      </button>
                    </div>

                    {catMode === "SELECT" && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenCatDropdown(!openCatDropdown)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#202024] text-sm font-medium flex items-center justify-between shadow-sm hover:border-slate-400 focus:ring-2 focus:ring-indigo-500 text-left"
                        >
                          <span className={categoryName ? "text-slate-900 dark:text-white font-semibold truncate pr-2" : "text-slate-400 dark:text-neutral-400"}>
                            {categoryName
                              ? `${categoryName} (Mã: ${categoriesList.find((c) => c.name === categoryName)?.letter || customCatLetter})`
                              : "-- Chọn chủng loại --"}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400 dark:text-neutral-400 shrink-0" />
                        </button>

                        {openCatDropdown && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setOpenCatDropdown(false)} />
                            <div className="absolute left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#1C1C20] shadow-xl py-1 z-30 divide-y divide-slate-50 dark:divide-neutral-800">
                              {categoriesList.map((c) => (
                                <div
                                  key={c.name}
                                  className={`group flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors ${
                                    categoryName === c.name ? "bg-indigo-50/70 dark:bg-white/10 font-bold text-indigo-900 dark:text-indigo-300" : "text-slate-700 dark:text-neutral-200"
                                  }`}
                                  onClick={() => {
                                    setCategoryName(c.name);
                                    setCustomCatLetter(c.letter);
                                    setOpenCatDropdown(false);
                                  }}
                                >
                                  <span className="flex items-center gap-2 truncate pr-2">
                                    {categoryName === c.name && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                    <span>
                                      {c.name} <span className="text-xs text-slate-400 dark:text-neutral-400 font-mono">(Mã: {c.letter})</span>
                                    </span>
                                  </span>
                                  <div
                                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCategoryName(c.name);
                                        setEditCatName(c.name);
                                        setEditCatLetter(c.letter);
                                        setCatMode("EDIT");
                                        setOpenCatDropdown(false);
                                      }}
                                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-neutral-800 rounded"
                                      title="Sửa chủng loại này"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (categoriesList.length <= 1) {
                                          alert("Phải giữ lại ít nhất 1 chủng loại sản phẩm trong danh sách!");
                                          return;
                                        }
                                        if (window.confirm(`Bạn có chắc muốn xóa chủng loại "${c.name}"?`)) {
                                          const nextList = categoriesList.filter((x) => x.name !== c.name);
                                          setCategoriesList(nextList);
                                          if (categoryName === c.name) {
                                            setCategoryName(nextList[0]?.name || "");
                                            setCustomCatLetter(nextList[0]?.letter || "A");
                                          }
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 rounded"
                                      title="Xóa chủng loại này"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {catMode === "ADD" && (
                      <div className="space-y-1.5">
                        <Input
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          placeholder="Tên chủng loại mới..."
                          className="h-9 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                          required
                        />
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={customCatLetter}
                            onChange={(e) => setCustomCatLetter(e.target.value.toUpperCase().slice(0, 1))}
                            placeholder="Mã (1 chữ cái)"
                            maxLength={1}
                            className="h-9 w-24 text-center font-mono font-bold uppercase text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                            required
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const trimmedName = categoryName.trim();
                              const trimmedLet = customCatLetter.trim().toUpperCase() || getRandomCapitalLetter();
                              if (trimmedName) {
                                setCategoriesList([...categoriesList, { name: trimmedName, letter: trimmedLet }]);
                                setCategoryName(trimmedName);
                              }
                              setCatMode("SELECT");
                            }}
                            className="h-9 text-xs px-3 bg-indigo-600 text-white font-bold ml-auto"
                          >
                            Thêm
                          </Button>
                        </div>
                      </div>
                    )}

                    {catMode === "EDIT" && (
                      <div className="space-y-1.5">
                        <Input
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          placeholder="Tên chủng loại..."
                          className="h-9 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                          required
                        />
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={editCatLetter}
                            onChange={(e) => setEditCatLetter(e.target.value.toUpperCase().slice(0, 1))}
                            placeholder="Mã (1 chữ cái)"
                            maxLength={1}
                            className="h-9 w-24 text-center font-mono font-bold uppercase text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                            required
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const trimmedName = editCatName.trim();
                              const trimmedLet = editCatLetter.trim().toUpperCase() || getRandomCapitalLetter();
                              if (trimmedName) {
                                setCategoriesList(
                                  categoriesList.map((c) =>
                                    c.name === categoryName ? { name: trimmedName, letter: trimmedLet } : c
                                  )
                                );
                                setCategoryName(trimmedName);
                              }
                              setCatMode("SELECT");
                            }}
                            className="h-9 text-xs px-3 bg-amber-600 text-white font-bold ml-auto"
                          >
                            Cập nhật
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Material / Raw Ingredient */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider">
                        Chất liệu / Nguyên liệu *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (matMode === "SELECT") {
                            setCustomMatLetter(getRandomCapitalLetter());
                            setMatMode("ADD");
                          } else {
                            setMatMode("SELECT");
                          }
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        {matMode === "SELECT" ? "+ Thêm mới" : "Hủy"}
                      </button>
                    </div>

                    {matMode === "SELECT" && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMatDropdown(!openMatDropdown)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-[#202024] text-sm font-medium flex items-center justify-between shadow-sm hover:border-slate-400 focus:ring-2 focus:ring-indigo-500 text-left"
                        >
                          <span className={subcategoryName ? "text-slate-900 dark:text-white font-semibold truncate pr-2" : "text-slate-400 dark:text-neutral-400"}>
                            {subcategoryName
                              ? `${subcategoryName} (Mã: ${materialsList.find((m) => m.name === subcategoryName)?.letter || customMatLetter})`
                              : "-- Chọn chất liệu --"}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400 dark:text-neutral-400 shrink-0" />
                        </button>

                        {openMatDropdown && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setOpenMatDropdown(false)} />
                            <div className="absolute left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#1C1C20] shadow-xl py-1 z-30 divide-y divide-slate-50 dark:divide-neutral-800">
                              {materialsList.map((m) => (
                                <div
                                  key={m.name}
                                  className={`group flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors ${
                                    subcategoryName === m.name ? "bg-indigo-50/70 dark:bg-white/10 font-bold text-indigo-900 dark:text-indigo-300" : "text-slate-700 dark:text-neutral-200"
                                  }`}
                                  onClick={() => {
                                    setSubcategoryName(m.name);
                                    setCustomMatLetter(m.letter);
                                    setOpenMatDropdown(false);
                                  }}
                                >
                                  <span className="flex items-center gap-2 truncate pr-2">
                                    {subcategoryName === m.name && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                    <span>
                                      {m.name} <span className="text-xs text-slate-400 dark:text-neutral-400 font-mono">(Mã: {m.letter})</span>
                                    </span>
                                  </span>
                                  <div
                                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSubcategoryName(m.name);
                                        setEditMatName(m.name);
                                        setEditMatLetter(m.letter);
                                        setMatMode("EDIT");
                                        setOpenMatDropdown(false);
                                      }}
                                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-neutral-800 rounded"
                                      title="Sửa chất liệu này"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (materialsList.length <= 1) {
                                          alert("Phải giữ lại ít nhất 1 chất liệu / nguyên liệu trong danh sách!");
                                          return;
                                        }
                                        if (window.confirm(`Bạn có chắc muốn xóa chất liệu "${m.name}"?`)) {
                                          const nextList = materialsList.filter((x) => x.name !== m.name);
                                          setMaterialsList(nextList);
                                          if (subcategoryName === m.name) {
                                            setSubcategoryName(nextList[0]?.name || "");
                                            setCustomMatLetter(nextList[0]?.letter || "A");
                                          }
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 rounded"
                                      title="Xóa chất liệu này"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {matMode === "ADD" && (
                      <div className="space-y-1.5">
                        <Input
                          value={subcategoryName}
                          onChange={(e) => setSubcategoryName(e.target.value)}
                          placeholder="Tên chất liệu / nguyên liệu mới..."
                          className="h-9 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                          required
                        />
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={customMatLetter}
                            onChange={(e) => setCustomMatLetter(e.target.value.toUpperCase().slice(0, 1))}
                            placeholder="Mã (1 chữ cái)"
                            maxLength={1}
                            className="h-9 w-24 text-center font-mono font-bold uppercase text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                            required
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const trimmedName = subcategoryName.trim();
                              const trimmedLet = customMatLetter.trim().toUpperCase() || getRandomCapitalLetter();
                              if (trimmedName) {
                                setMaterialsList([...materialsList, { name: trimmedName, letter: trimmedLet }]);
                                setSubcategoryName(trimmedName);
                              }
                              setMatMode("SELECT");
                            }}
                            className="h-9 text-xs px-3 bg-indigo-600 text-white font-bold ml-auto"
                          >
                            Thêm
                          </Button>
                        </div>
                      </div>
                    )}

                    {matMode === "EDIT" && (
                      <div className="space-y-1.5">
                        <Input
                          value={editMatName}
                          onChange={(e) => setEditMatName(e.target.value)}
                          placeholder="Tên chất liệu / nguyên liệu..."
                          className="h-9 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                          required
                        />
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={editMatLetter}
                            onChange={(e) => setEditMatLetter(e.target.value.toUpperCase().slice(0, 1))}
                            placeholder="Mã (1 chữ cái)"
                            maxLength={1}
                            className="h-9 w-24 text-center font-mono font-bold uppercase text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                            required
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const trimmedName = editMatName.trim();
                              const trimmedLet = editMatLetter.trim().toUpperCase() || getRandomCapitalLetter();
                              if (trimmedName) {
                                setMaterialsList(
                                  materialsList.map((m) =>
                                    m.name === subcategoryName ? { name: trimmedName, letter: trimmedLet } : m
                                  )
                                );
                                setSubcategoryName(trimmedName);
                              }
                              setMatMode("SELECT");
                            }}
                            className="h-9 text-xs px-3 bg-amber-600 text-white font-bold ml-auto"
                          >
                            Cập nhật
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selling Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">
                    Giá bán dự kiến (VNĐ) *
                  </label>
                  <Input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="Ví dụ: 350000"
                    className="h-10 text-sm font-medium dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white font-mono"
                    required
                  />
                </div>

                {/* Color Selection Section */}
                <div className="space-y-2 border-t border-slate-100 dark:border-neutral-800 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-neutral-200 uppercase tracking-wider">
                      Màu sắc ({selectedColors.length})
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={customColorInput}
                        onChange={(e) => setCustomColorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomColor();
                          }
                        }}
                        placeholder="+ Nhập màu..."
                        className="h-7 text-xs w-32 dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addCustomColor}
                        className="h-7 text-xs px-2 dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200"
                      >
                        Thêm
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {colorChipsList.map((cName) => {
                      const isSelected = selectedColors.includes(cName);
                      return (
                        <div
                          key={cName}
                          className={`group relative inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm ${
                            isSelected
                              ? "bg-slate-900 dark:bg-white text-white dark:text-black border-slate-900 dark:border-white font-bold"
                              : "bg-slate-50 dark:bg-[#202024] text-slate-700 dark:text-neutral-200 border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? selectedColors.filter((x) => x !== cName)
                                : [...selectedColors, cName];
                              setSelectedColors(next);
                              setColorName(next.join(", "));
                            }}
                            className="flex items-center gap-1"
                          >
                            {isSelected ? `✓ ${cName}` : cName}
                          </button>

                          {/* Hover Pencil & Trash2 icons */}
                          <div className="flex items-center gap-0.5 ml-1 border-l pl-1 border-slate-300 dark:border-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditColorChip(cName);
                              }}
                              className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
                              title="Sửa tên màu"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteColorChip(cName);
                              }}
                              className="p-0.5 text-slate-400 hover:text-rose-400 rounded"
                              title="Xóa màu này khỏi danh sách"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Size Selection Section */}
                <div className="space-y-2 border-t border-slate-100 dark:border-neutral-800 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-neutral-200 uppercase tracking-wider">
                      Kích thước / Size ({selectedSizes.length})
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={customSizeInput}
                        onChange={(e) => setCustomSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomSize();
                          }
                        }}
                        placeholder="+ Nhập size..."
                        className="h-7 text-xs w-32 uppercase dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addCustomSize}
                        className="h-7 text-xs px-2 dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200"
                      >
                        Thêm
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {sizeChipsList.map((sz) => {
                      const isSelected = selectedSizes.includes(sz);
                      return (
                        <div
                          key={sz}
                          className={`group relative inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                            isSelected
                              ? "bg-slate-900 dark:bg-white text-white dark:text-black border-slate-900 dark:border-white"
                              : "bg-slate-50 dark:bg-[#202024] text-slate-700 dark:text-neutral-200 border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? selectedSizes.filter((x) => x !== sz)
                                : [...selectedSizes, sz];
                              setSelectedSizes(next);
                              setSizeName(next.join(", "));
                            }}
                            className="flex items-center gap-1"
                          >
                            {isSelected ? `✓ ${sz}` : sz}
                          </button>

                          {/* Hover Pencil & Trash2 icons */}
                          <div className="flex items-center gap-0.5 ml-1 border-l pl-1 border-indigo-300 dark:border-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditSizeChip(sz);
                              }}
                              className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
                              title="Sửa size"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSizeChip(sz);
                              }}
                              className="p-0.5 text-slate-400 hover:text-rose-200 rounded"
                              title="Xóa size này khỏi danh sách"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer Bar */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-[#202024] shrink-0">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="text-slate-600 dark:text-neutral-200 dark:bg-[#242428] dark:border-neutral-700">
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold px-5 shadow-lg"
                >
                  {isSubmitting ? "Đang lưu..." : "Lưu Sản Phẩm & Sinh SKU"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm / Sửa Nhà sản xuất (NSX) */}
      {showMfrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-[#202024]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingMfr ? "Sửa Nhà sản xuất" : "Thêm Nhà sản xuất mới"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMfrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddManufacturer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">
                  Tên Nhà sản xuất (Xưởng may) *
                </label>
                <Input
                  value={mfrName}
                  onChange={(e) => setMfrName(e.target.value)}
                  placeholder="Ví dụ: Xưởng may Thanh Nam"
                  className="h-10 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">
                  Mã NSX (3 chữ số EAN-8 Barcode)
                </label>
                <Input
                  value={mfrCode}
                  onChange={(e) => setMfrCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Ví dụ: 893 (để trống tự sinh ngẫu nhiên)"
                  maxLength={3}
                  className="h-10 text-sm font-mono dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 dark:text-neutral-400 mt-1">Dùng để ghép mã vạch sản phẩm chuẩn EAN-8</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">
                    Số điện thoại
                  </label>
                  <Input
                    value={mfrPhone}
                    onChange={(e) => setMfrPhone(e.target.value)}
                    placeholder="090..."
                    className="h-9 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">
                    Mã số thuế
                  </label>
                  <Input
                    value={mfrTaxId}
                    onChange={(e) => setMfrTaxId(e.target.value)}
                    placeholder="MST..."
                    className="h-9 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">
                  Địa chỉ xưởng / trụ sở
                </label>
                <Input
                  value={mfrAddress}
                  onChange={(e) => setMfrAddress(e.target.value)}
                  placeholder="Địa chỉ..."
                  className="h-9 text-sm dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMfrModal(false)}
                  className="text-xs h-9 dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isMfrSubmitting}
                  className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {isMfrSubmitting ? "Đang lưu..." : editingMfr ? "Cập nhật" : "Tạo Nhà sản xuất"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Quản lý Danh sách Nhà sản xuất (NSX) */}
      {showMfrListModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-[#202024] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Quản lý Nhà sản xuất / Xưởng may
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
                      {manufacturers.length} NSX
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Khai báo danh sách xưởng may, nhà cung ứng và mã barcode EAN-8</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingMfr(null);
                    setMfrName("");
                    setMfrCode("");
                    setMfrAddress("");
                    setMfrPhone("");
                    setMfrTaxId("");
                    setShowMfrModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Thêm NSX mới
                </Button>
                <button
                  onClick={() => setShowMfrListModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Table of Manufacturers */}
            <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-neutral-800">
              {manufacturers.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-3">
                    <Building2 className="h-8 w-8 stroke-[1.5]" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200">Chưa có Nhà sản xuất nào</p>
                  <p className="text-xs text-slate-400 dark:text-neutral-400 mt-1 max-w-xs mx-auto">
                    Thêm các xưởng may hoặc đối tác sản xuất để quản lý đơn đặt hàng và sinh mã vạch Barcode.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingMfr(null);
                      setMfrName("");
                      setMfrCode("");
                      setMfrAddress("");
                      setMfrPhone("");
                      setMfrTaxId("");
                      setShowMfrModal(true);
                    }}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Nhà sản xuất đầu tiên
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-700">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#26262B] border-b dark:border-neutral-700 text-slate-600 dark:text-neutral-200 uppercase font-bold">
                        <th className="px-4 py-3">Mã EAN-8</th>
                        <th className="px-4 py-3">Tên Nhà sản xuất / Xưởng</th>
                        <th className="px-4 py-3">Điện thoại</th>
                        <th className="px-4 py-3">Địa chỉ / MST</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {manufacturers.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 rounded text-[11px]">
                              {m.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {m.name}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-neutral-300">
                            {m.phone || <span className="text-slate-400 dark:text-neutral-500 italic">--</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-neutral-400">
                            <div>{m.address || <span className="text-slate-400 dark:text-neutral-500 italic">Chưa có địa chỉ</span>}</div>
                            {m.taxId && <div className="text-[10px] text-slate-400 dark:text-neutral-500">MST: {m.taxId}</div>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingMfr(m);
                                  setMfrName(m.name);
                                  setMfrCode(m.code);
                                  setMfrAddress(m.address || "");
                                  setMfrPhone(m.phone || "");
                                  setMfrTaxId(m.taxId || "");
                                  setShowMfrModal(true);
                                }}
                                className="h-7 text-[11px] px-2 text-slate-700 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-white border-slate-200 dark:border-neutral-700 dark:bg-[#242428]"
                              >
                                <Pencil className="h-3 w-3 mr-1" /> Sửa
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Xóa Nhà sản xuất "${m.name}"?`,
                                    description: `Bạn có chắc muốn xóa NSX "${m.name}" (Mã: ${m.code})? Các sản phẩm liên kết với NSX này sẽ được chuyển về trạng thái không thuộc NSX nào.`,
                                    confirmLabel: "Xóa",
                                    cancelLabel: "Hủy",
                                    tone: "destructive",
                                  });
                                  if (ok) {
                                    try {
                                      const res = await fetch(`/api/manufacturers/${m.id}`, { method: "DELETE" });
                                      if (!res.ok) throw new Error("Lỗi xóa NSX");
                                      notify({ tone: "success", title: "Đã xóa NSX", body: `Đã xóa "${m.name}"` });
                                      mutate();
                                    } catch (e: any) {
                                      notify({ tone: "error", title: "Lỗi", body: e.message });
                                    }
                                  }
                                }}
                                className="h-7 text-[11px] px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 dark:bg-rose-950/20"
                              >
                                <Trash2 className="h-3 w-3 mr-1" /> Xóa
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-[#202024] shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowMfrListModal(false)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sửa Dòng Sản Phẩm / SKU (editingGroup) */}
      {editingGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-neutral-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Sửa Dòng Sản Phẩm & SKU
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 font-mono">Mã gốc: {editingGroup.baseSku}xxxx</p>
              </div>
              <button onClick={() => setEditingGroup(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroupEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Tên sản phẩm *</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Thương hiệu (Brand)</label>
                  <Input
                    value={editBrandName}
                    onChange={(e) => setEditBrandName(e.target.value)}
                    placeholder="VD: Dakblancy"
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Đơn vị tính</label>
                  <Input
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Màu sắc (phân cách bởi dấu phẩy)</label>
                  <Input
                    value={editColorsInput}
                    onChange={(e) => setEditColorsInput(e.target.value)}
                    placeholder="Đỏ, Đen, Xanh..."
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Size (phân cách bởi dấu phẩy)</label>
                  <Input
                    value={editSizesInput}
                    onChange={(e) => setEditSizesInput(e.target.value)}
                    placeholder="S, M, L, XL..."
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Giá nhập (VND)</label>
                  <Input
                    type="number"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Giá bán (VND) *</label>
                  <Input
                    type="number"
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t dark:border-neutral-800 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (!editingGroup) return;
                    const groupTitle = editingGroup.colorName ? `${editingGroup.name} - Màu ${editingGroup.colorName}` : editingGroup.name;
                    const ok = await confirm({
                      title: `Xác nhận xóa cụm sản phẩm?`,
                      description: `Bạn có chắc muốn xóa vĩnh viễn cụm sản phẩm "${groupTitle}" (Mã gốc: ${editingGroup.baseSku}xx) cùng toàn bộ ${editingGroup.variants.length} biến thể size của màu này?`,
                      confirmLabel: "Xóa toàn bộ",
                      cancelLabel: "Hủy",
                      tone: "destructive",
                    });
                    if (ok) {
                      try {
                        const res = await fetch("/api/products/batch-update", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            categoryId: editingGroup.category.id,
                            subcategoryId: editingGroup.subcategory.id,
                            itemCode: editingGroup.itemCode,
                            colorCode: editingGroup.colorCode || undefined,
                          }),
                        });
                        const resJson = await res.json();
                        if (!res.ok) throw new Error(resJson.error || "Lỗi xóa cụm sản phẩm");
                        notify({ tone: "success", title: "Đã xóa", body: `Đã xóa cụm sản phẩm "${groupTitle}"` });
                        setEditingGroup(null);
                        mutate();
                      } catch (err: any) {
                        notify({ tone: "error", title: "Lỗi", body: err.message });
                      }
                    }
                  }}
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 dark:bg-rose-950/20 text-xs font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa cụm này
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingGroup(null)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                    Hủy
                  </Button>
                  <Button type="submit" disabled={isEditSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {isEditSubmitting ? "Đang lưu..." : "Lưu Cập Nhật SKU"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa Biến Thể Đơn Lẻ (editingVariant) */}
      {editingVariant && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#18181B] dark:border dark:border-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-neutral-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Sửa Biến Thể SKU
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 font-mono">Mã SKU: {editingVariant.sku}</p>
              </div>
              <button onClick={() => setEditingVariant(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVariantEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Tên sản phẩm</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Màu sắc</label>
                  <Input
                    value={editColorName}
                    onChange={(e) => setEditColorName(e.target.value)}
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Size</label>
                  <Input
                    value={editSizeName}
                    onChange={(e) => setEditSizeName(e.target.value)}
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Giá nhập (VND)</label>
                  <Input
                    type="number"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase tracking-wider mb-1">Giá bán (VND) *</label>
                  <Input
                    type="number"
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="dark:bg-[#202024] dark:border-neutral-700/80 dark:text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t dark:border-neutral-800 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (!editingVariant) return;
                    const ok = await confirm({
                      title: `Xóa biến thể SKU "${editingVariant.sku}"?`,
                      description: `Bạn có chắc muốn xóa biến thể SKU "${editingVariant.sku}" (${editingVariant.colorName || "Không màu"} - Size ${editingVariant.sizeName || "—"})?`,
                      confirmLabel: "Xóa biến thể",
                      cancelLabel: "Hủy",
                      tone: "destructive",
                    });
                    if (ok) {
                      try {
                        const res = await fetch(`/api/products/${editingVariant.id}`, { method: "DELETE" });
                        if (!res.ok) throw new Error("Lỗi xóa biến thể");
                        notify({ tone: "success", title: "Đã xóa", body: `Đã xóa biến thể SKU "${editingVariant.sku}"` });
                        setEditingVariant(null);
                        mutate();
                      } catch (err: any) {
                        notify({ tone: "error", title: "Lỗi", body: err.message });
                      }
                    }
                  }}
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 dark:bg-rose-950/20 text-xs font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa biến thể
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingVariant(null)} className="dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                    Hủy
                  </Button>
                  <Button type="submit" disabled={isEditSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {isEditSubmitting ? "Đang lưu..." : "Lưu Thay Đổi"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal In Tem May Mặc Bán Hàng */}
      <ProductTagPrintModal
        product={selectedBarcodeProduct}
        isOpen={!!selectedBarcodeProduct}
        onClose={() => setSelectedBarcodeProduct(null)}
        onPrinted={async (productId) => {
          try {
            await fetch(`/api/products/${productId}/mark-printed`, { method: "POST" });
            mutate();
          } catch (err: any) {
            console.error("Mark printed error:", err);
          }
        }}
      />
    </div>
  );
}
