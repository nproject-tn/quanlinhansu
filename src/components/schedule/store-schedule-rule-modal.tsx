"use client";

import { useState, useEffect } from "react";
import { X, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useNotifications } from "@/components/notifications/notification-center";

type Store = {
  id: string;
  name: string;
  shiftsPerDay: number;
  maxHoursPerDay: number | null;
  maxShiftsPerDay: number | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  stores: Store[];
};

export function StoreScheduleRuleModal({ isOpen, onClose, stores }: Props) {
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [ruleType, setRuleType] = useState<"hours" | "shifts">("shifts");
  const [ruleValue, setRuleValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { notify } = useNotifications();

  useEffect(() => {
    if (isOpen && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [isOpen, stores, selectedStoreId]);

  useEffect(() => {
    const store = stores.find(s => s.id === selectedStoreId);
    if (store) {
      if (store.maxHoursPerDay) {
        setRuleType("hours");
        setRuleValue(store.maxHoursPerDay.toString());
      } else if (store.maxShiftsPerDay) {
        setRuleType("shifts");
        setRuleValue(store.maxShiftsPerDay.toString());
      } else {
        setRuleType("shifts");
        setRuleValue("");
      }
    }
  }, [selectedStoreId, stores]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selectedStoreId) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/stores/${selectedStoreId}/schedule-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxHoursPerDay: ruleType === "hours" && ruleValue ? parseInt(ruleValue) : null,
          maxShiftsPerDay: ruleType === "shifts" && ruleValue ? parseInt(ruleValue) : null,
        })
      });

      if (!res.ok) throw new Error("Lỗi khi lưu");
      notify({ title: "Thành công", body: "Đã lưu cài đặt", tone: "success" });
      window.dispatchEvent(new CustomEvent("refresh-schedule-stores"));
      onClose();
    } catch (e) {
      notify({ title: "Lỗi", body: "Không thể lưu cài đặt", tone: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 animate-in fade-in backdrop-blur-xs">
      <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 dark:bg-neutral-800 rounded-xl text-slate-800 dark:text-neutral-200">
              <Settings className="h-5 w-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Giới hạn xếp ca</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-neutral-800 dark:hover:text-white p-2 rounded-xl transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 block mb-2">Cửa hàng</label>
            <Select
              value={selectedStoreId}
              onChange={e => setSelectedStoreId(e.target.value)}
              className="w-full h-10"
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          <div className="bg-slate-50 dark:bg-[#202024] border border-slate-200 dark:border-neutral-700/80 rounded-xl p-4 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 block mb-1.5">Loại quy tắc theo ngày</label>
              <Select
                value={ruleType}
                onChange={e => {
                  setRuleType(e.target.value as "hours" | "shifts");
                  setRuleValue("");
                }}
                className="w-full mb-1"
              >
                <option value="shifts">Giới hạn số ca làm / ngày</option>
                <option value="hours">Giới hạn số giờ làm / ngày</option>
              </Select>
            </div>
            
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 block mb-1.5">
                {ruleType === "shifts" ? "Số ca làm tối đa / ngày" : "Số giờ làm tối đa / ngày"}
              </label>
              <Input
                type="number"
                value={ruleValue}
                onChange={e => setRuleValue(e.target.value)}
                placeholder={`Ví dụ: ${ruleType === "shifts" ? "2" : "8"}`}
                min="1" max={ruleType === "shifts" ? "10" : "24"}
                className="h-10 text-sm font-semibold"
              />
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1.5">Bỏ trống nếu không giới hạn</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-[#141416] flex justify-end gap-3 rounded-b-2xl">
          <Button variant="outline" onClick={onClose} className="dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700">
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-bold shadow-md">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu cài đặt
          </Button>
        </div>
      </div>
    </div>
  );
}
