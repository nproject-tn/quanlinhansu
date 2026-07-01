"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { useNotifications } from "@/components/notifications/notification-center";

type Store = {
  id: string;
  name: string;
  address?: string;
  logoUrl?: string;
  shiftsPerDay?: number;
  isActive: boolean;
  _count?: { employees: number };
  shiftTemplates?: { id: string; name: string; startTime: string; endTime: string }[];
};

const ACCEPTED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];
const ACCEPTED_LOGO_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".heic",
  ".heif",
  ".bmp",
  ".ico",
];
const LOGO_ACCEPT = [...ACCEPTED_LOGO_TYPES, ...ACCEPTED_LOGO_EXTENSIONS].join(",");
const MAX_LOGO_SIZE_MB = 10;

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Không đọc được ảnh"));
    reader.readAsDataURL(file);
  });
}

async function readJsonSafely<T>(response: Response, fallback: T): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return fallback;

  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function isSupportedLogoFile(file: File) {
  const fileName = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_LOGO_EXTENSIONS.some((extension) =>
    fileName.endsWith(extension)
  );

  return ACCEPTED_LOGO_TYPES.includes(file.type) || hasAcceptedExtension || !file.type;
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [shiftsPerDay, setShiftsPerDay] = useState("3");
  const [message, setMessage] = useState<string | null>(null);
  const [editingShiftsFor, setEditingShiftsFor] = useState<string | null>(null);
  const [editShiftsPerDay, setEditShiftsPerDay] = useState("");
  const [editingNameFor, setEditingNameFor] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    if (!message) return;

    notify({
      title: "Thông báo cửa hàng",
      body: message,
      tone: message.toLowerCase().includes("không") || message.toLowerCase().includes("lỗi") ? "error" : "success",
      dedupeKey: `stores|${message}`,
    });
    setMessage(null);
  }, [message, notify]);

  async function load() {
    const res = await fetch("/api/stores", { cache: "no-store" });
    const data = await readJsonSafely<Store[]>(res, []);
    if (!res.ok) {
      setMessage("Không tải được dữ liệu cửa hàng");
      setStores([]);
      return;
    }
    setStores(data.filter((s: Store) => s.isActive));
  }

  useEffect(() => {
    load();
  }, []);

  async function prepareLogoFile(file: File | null) {
    if (!file) return null;

    if (!isSupportedLogoFile(file)) {
      setMessage("Định dạng chưa hỗ trợ. Hãy dùng PNG, JPG, WEBP, GIF, SVG, AVIF, HEIC, BMP hoặc ICO.");
      return null;
    }

    if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
      setMessage(`Ảnh quá lớn. Vui lòng chọn file nhỏ hơn ${MAX_LOGO_SIZE_MB}MB.`);
      return null;
    }

    return fileToDataUrl(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setMessage("Vui lòng nhập tên cửa hàng trước khi thêm.");
      return;
    }

    const count = Number(shiftsPerDay);
    if (!count || count < 1) {
      setMessage("Số ca/ngày phải lớn hơn 0");
      return;
    }
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, logoUrl, shiftsPerDay: count, isActive: true }),
    });
    const data = await readJsonSafely<{ id: string; error?: string; logoPendingMigration?: boolean }>(
      res,
      { id: "" }
    );

    if (!res.ok || !data.id) {
      setMessage(data.error ?? "Không thêm được cửa hàng");
      return;
    }

    await fetch(`/api/stores/${data.id}/shifts-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftsPerDay: count }),
    });
    setMessage(
      data.logoPendingMigration
        ? "Đã thêm cửa hàng, nhưng logo sẽ chỉ lưu được sau khi cập nhật database."
        : "Đã thêm cửa hàng và tạo ca mặc định"
    );
    setName("");
    setAddress("");
    setLogoUrl("");
    setShiftsPerDay("3");
    await load();
  }

  async function handleSaveShifts(storeId: string) {
    const count = Number(editShiftsPerDay);
    if (!count || count < 1) {
      setMessage("Số ca/ngày phải lớn hơn 0");
      return;
    }
    const res = await fetch(`/api/stores/${storeId}/shifts-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftsPerDay: count }),
    });
    const data = await readJsonSafely<{ message?: string; error?: string }>(res, {});
    if (res.ok) {
      setMessage(data.message ?? "Đã lưu cấu hình số ca");
      setEditingShiftsFor(null);
      await load();
    } else {
      setMessage(data.error ?? "Lỗi lưu cấu hình ca");
    }
  }

  async function handleDelete(id: string, storeName: string) {
    const approved = await confirm({
      title: `Xóa cửa hàng "${storeName}"?`,
      description: "Cửa hàng này sẽ bị ẩn khỏi hệ thống và không còn dùng để xếp ca.",
      confirmLabel: "Xóa cửa hàng",
      cancelLabel: "Huỷ",
      tone: "destructive",
    });
    if (!approved) return;
    const res = await fetch(`/api/stores/${id}`, { method: "DELETE" });
    const data = await readJsonSafely<{ message?: string }>(res, {});
    setMessage(data.message ?? "Đã xóa");
    await load();
  }

  async function handleLogoChange(store: Store, file: File | null) {
    if (!file) return;

    const nextLogoUrl = await prepareLogoFile(file);
    if (!nextLogoUrl) return;

    const res = await fetch(`/api/stores/${store.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: store.name,
        address: store.address ?? "",
        logoUrl: nextLogoUrl,
        shiftsPerDay: store.shiftsPerDay ?? 3,
        isActive: store.isActive,
      }),
    });
    const data = await readJsonSafely<{ error?: string; logoPendingMigration?: boolean }>(res, {});
    setMessage(
      data.error ??
        (data.logoPendingMigration
          ? "Ảnh đã được chọn, nhưng database hiện chưa lưu được logo. Cần cập nhật schema trước."
          : "Đã cập nhật logo cửa hàng")
    );
    await load();
  }

  async function handleSaveName(store: Store) {
    if (!editName.trim()) return;
    setEditingNameFor(null);
    const res = await fetch(`/api/stores/${store.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        address: store.address ?? "",
        logoUrl: store.logoUrl,
        shiftsPerDay: store.shiftsPerDay ?? 3,
        isActive: store.isActive,
      }),
    });
    const data = await readJsonSafely<{ error?: string }>(res, {});
    setMessage(data.error ?? "Đã cập nhật tên cửa hàng");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quản lý cửa hàng</h1>
        <p className="text-slate-600">Thêm, xóa cửa hàng — nhân viên luân phiên giữa các cửa hàng</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Thêm cửa hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-4">
            <Input placeholder="Tên cửa hàng" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
            <Input placeholder="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} className="max-w-md" />
            <div className="flex items-center gap-3">
              <label className="flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo xem trước" className="h-full w-full object-cover" />
                ) : (
                  <span>Logo</span>
                )}
                <input
                  type="file"
                  accept={LOGO_ACCEPT}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (!file) return;
                    const nextLogoUrl = await prepareLogoFile(file);
                    if (nextLogoUrl) {
                      setLogoUrl(nextLogoUrl);
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Số ca/ngày:</span>
              <Input type="number" min="1" value={shiftsPerDay} onChange={(e) => setShiftsPerDay(e.target.value)} className="w-20" required />
            </div>
            <Button type="submit">Thêm</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {stores.map((store) => (
          <Card key={store.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center flex-col gap-1">
                  <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500 hover:border-blue-400 transition-colors">
                    {store.logoUrl ? (
                      <img src={store.logoUrl} alt={store.name} className="h-full w-full object-cover" />
                    ) : (
                      <span>Logo</span>
                    )}
                  </span>
                  <span className="text-[10px] font-medium text-blue-600">Đổi logo</span>
                  <input
                    type="file"
                    accept={LOGO_ACCEPT}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0] ?? null;
                      await handleLogoChange(store, file);
                    }}
                  />
                </label>
                <div>
                  {editingNameFor === store.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 w-40"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSaveName(store);
                          } else if (e.key === "Escape") {
                            setEditingNameFor(null);
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleSaveName(store)}>Lưu</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNameFor(null)}>Hủy</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CardTitle>{store.name}</CardTitle>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-slate-400 hover:text-blue-600"
                        onClick={(e) => {
                          e.preventDefault();
                          setEditingNameFor(store.id);
                          setEditName(store.name);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(store.id, store.name)}>
                Xóa
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>{store.address || "Chưa có địa chỉ"}</p>
              <p>{store._count?.employees ?? 0} nhân viên phụ trách</p>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                {editingShiftsFor === store.id ? (
                  <>
                    <span className="text-slate-600">Số ca/ngày:</span>
                    <Input
                      type="number"
                      min="1"
                      value={editShiftsPerDay}
                      onChange={(e) => setEditShiftsPerDay(e.target.value)}
                      className="w-20 h-8"
                    />
                    <Button size="sm" onClick={() => handleSaveShifts(store.id)}>Lưu</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingShiftsFor(null)}>Hủy</Button>
                  </>
                ) : (
                  <>
                    <span>{store.shiftsPerDay ?? 3} ca/ngày · {store.shiftTemplates?.length ?? 0} ca đã cấu hình</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditingShiftsFor(store.id);
                        setEditShiftsPerDay(String(store.shiftsPerDay ?? 3));
                      }}
                    >
                      Sửa số ca
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
