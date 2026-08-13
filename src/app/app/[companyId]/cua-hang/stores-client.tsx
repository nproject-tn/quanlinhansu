"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmDialog } from "@/components/confirm/confirm-dialog-provider";
import { useNotifications } from "@/components/notifications/notification-center";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';


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

function SortableStoreCard({
  store, canEdit, editingNameFor, setEditingNameFor, editName, setEditName, handleSaveName, handleDelete, handleLogoChange, editingShiftsFor, setEditingShiftsFor, editShiftsPerDay, setEditShiftsPerDay, handleSaveShifts, LOGO_ACCEPT
}: any) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: store.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
      <Card className={isDragging ? 'shadow-xl ring-2 ring-primary border-primary' : ''}>
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
            {canEdit && (
              <>
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
              </>
            )}
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
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingNameFor(store.id);
                      setEditName(store.name);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600 p-1">
              <GripVertical size={20} />
            </div>
            <Button size="sm" variant="destructive" onClick={() => handleDelete(store.id, store.name)}>
              Xóa
            </Button>
          </div>
        )}
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
              {canEdit && (
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
              )}
            </>
          )}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}


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

export default function StoresClient({ canEdit }: { canEdit?: boolean }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [shiftsPerDay, setShiftsPerDay] = useState("3");
  const [message, setMessage] = useState<string | null>(null);
  const [editingShiftsFor, setEditingShiftsFor] = useState<string | null>(null);
  const [editShiftsPerDay, setEditShiftsPerDay] = useState("");
  const [editingNameFor, setEditingNameFor] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { notify } = useNotifications();
  const { confirm } = useConfirmDialog();

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    const data = await readJsonSafely<Store[]>(res, []);
    if (!res.ok) throw new Error("Không tải được dữ liệu cửa hàng");
    return data.filter((s: Store) => s.isActive);
  };

  const { data: storesData, mutate: load, error } = useSWR("/api/stores", fetcher);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    if (storesData) {
      setStores(storesData);
    }
  }, [storesData]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStores((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save new order to backend
        fetch("/api/stores/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeIds: newItems.map(s => s.id) })
        }).catch(err => console.error("Failed to save reorder", err));

        return newItems;
      });
    }
  }


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

  useEffect(() => {
    if (error) {
      setMessage(error.message);
    }
  }, [error]);

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
    setIsLoading(true);
    try {
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
    } finally {
      setIsLoading(false);
    }
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
      <Card>
        <CardHeader>
          <CardTitle>Thêm cửa hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!canEdit && (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm mb-4">
                Bạn đang ở chế độ xem. Bạn không có quyền thêm hay chỉnh sửa cửa hàng.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <Input placeholder="Tên cửa hàng" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" disabled={!canEdit} />
              <Input placeholder="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} className="max-w-md" disabled={!canEdit} />
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
                    disabled={!canEdit}
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
                <Input type="number" min="1" value={shiftsPerDay} onChange={(e) => setShiftsPerDay(e.target.value)} className="w-20" required disabled={!canEdit} />
              </div>
              <Button type="submit" disabled={!canEdit || isLoading}>Thêm</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stores.map(s => s.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-4 md:grid-cols-2">
            {stores.map((store) => (
              <SortableStoreCard
                key={store.id}
                store={store}
                canEdit={canEdit}
                editingNameFor={editingNameFor}
                setEditingNameFor={setEditingNameFor}
                editName={editName}
                setEditName={setEditName}
                handleSaveName={handleSaveName}
                handleDelete={handleDelete}
                handleLogoChange={handleLogoChange}
                editingShiftsFor={editingShiftsFor}
                setEditingShiftsFor={setEditingShiftsFor}
                editShiftsPerDay={editShiftsPerDay}
                setEditShiftsPerDay={setEditShiftsPerDay}
                handleSaveShifts={handleSaveShifts}
                LOGO_ACCEPT={LOGO_ACCEPT}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
