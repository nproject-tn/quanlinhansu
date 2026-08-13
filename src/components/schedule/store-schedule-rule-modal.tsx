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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-800">
              <Settings className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Giới hạn xếp ca</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Cửa hàng</label>
            <Select
              value={selectedStoreId}
              onChange={e => setSelectedStoreId(e.target.value)}
              className="w-full"
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          <div className="bg-slate-50 border rounded-xl p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Loại quy tắc theo ngày</label>
              <Select
                value={ruleType}
                onChange={e => {
                  setRuleType(e.target.value as "hours" | "shifts");
                  setRuleValue("");
                }}
                className="w-full mb-4"
              >
                <option value="shifts">Giới hạn số ca làm / ngày</option>
                <option value="hours">Giới hạn số giờ làm / ngày</option>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                {ruleType === "shifts" ? "Số ca làm tối đa / ngày" : "Số giờ làm tối đa / ngày"}
              </label>
              <Input
                type="number"
                value={ruleValue}
                onChange={e => setRuleValue(e.target.value)}
                placeholder={`Ví dụ: ${ruleType === "shifts" ? "2" : "8"}`}
                min="1" max={ruleType === "shifts" ? "10" : "24"}
              />
              <p className="text-xs text-slate-500 mt-1">Bỏ trống nếu không giới hạn</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-slate-50/50 flex justify-end gap-3 rounded-b-xl">
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu cài đặt
          </Button>
        </div>
      </div>
    </div>
  );
}
