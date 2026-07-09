import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type OvertimeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (employeeId: string, hours: number) => Promise<void>;
  employees: { id: string; name: string }[];
  existingEmployeeIds: Set<string>;
  loading?: boolean;
  initialEmployeeId?: string;
  initialHours?: number;
  mode: "add" | "edit";
};

export function OvertimeModal({
  isOpen,
  onClose,
  onSubmit,
  employees,
  existingEmployeeIds,
  loading,
  initialEmployeeId,
  initialHours,
  mode,
}: OvertimeModalProps) {
  const [employeeId, setEmployeeId] = useState<string>(initialEmployeeId || "");
  const [hours, setHours] = useState<string>(initialHours ? initialHours.toString() : "");

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !hours || isNaN(Number(hours))) return;
    await onSubmit(employeeId, Number(hours));
  };

  if (!isOpen) return null;

  const availableEmployees = mode === "add" 
    ? employees.filter(emp => !existingEmployeeIds.has(emp.id))
    : employees;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-sm max-h-[90vh] flex flex-col shadow-lg animate-in fade-in-0 zoom-in-95">
        <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
          <CardTitle className="text-lg font-semibold">
            {mode === "add" ? "Thêm giờ làm thêm" : "Sửa giờ làm thêm"}
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Đóng</span>
          </button>
        </CardHeader>
        <CardContent className="px-6 pb-6 flex-1 overflow-y-auto">
          <p className="text-sm text-slate-500 mb-4">
            Điền số giờ làm thêm cho nhân viên trong ca này.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="employeeId" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Nhân viên
              </label>
              <Select
                id="employeeId"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={mode === "edit" || loading}
              >
                <option value="" disabled>Chọn nhân viên</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
                {mode === "edit" && initialEmployeeId && !availableEmployees.find(e => e.id === initialEmployeeId) && (
                  <option value={initialEmployeeId}>
                    {employees.find(e => e.id === initialEmployeeId)?.name || "Nhân viên"}
                  </option>
                )}
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="hours" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Số giờ
              </label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Huỷ
              </Button>
              <Button type="submit" disabled={loading || !employeeId || !hours}>
                Lưu
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
