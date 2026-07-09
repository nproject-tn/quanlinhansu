"use client";

import { X, Calendar, Image as ImageIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

type Fault = {
  id: string;
  note: string | null;
  evidenceUrl?: string | null;
  date: string | Date;
  shiftName: string;
  createdAt: string | Date;
};

type EmployeeFaultsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  month: string;
  faults: Fault[];
};

export function EmployeeFaultsModal({
  isOpen,
  onClose,
  employeeName,
  month,
  faults,
}: EmployeeFaultsModalProps) {
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Group faults by date
  const groupedFaults = faults.reduce((acc, fault) => {
    const dateStr = format(new Date(fault.date), "dd/MM/yyyy", { locale: vi });
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(fault);
    return acc;
  }, {} as Record<string, typeof faults>);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-lg max-h-[90vh] flex flex-col shadow-lg animate-in fade-in-0 zoom-in-95">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b shrink-0">
          <CardTitle className="text-lg font-semibold flex flex-col">
            <span>Chi tiết lỗi của {employeeName}</span>
            <span className="text-sm font-normal text-slate-500 mt-1">
              Tháng {format(parseISO(`${month}-01`), "MM/yyyy")}
            </span>
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 self-start"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </CardHeader>

        <CardContent className="px-6 py-4 flex-1 overflow-y-auto">
          {faults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500">
              <Calendar className="h-10 w-10 mb-3 opacity-20" />
              <p>Không có lỗi nào được ghi nhận trong tháng này.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedFaults).map((dateStr) => (
                <div key={dateStr} className="space-y-3">
                  <div className="font-semibold text-slate-800 bg-slate-100 px-3 py-2 rounded">
                    Ngày {dateStr}
                  </div>
                  <div className="space-y-4 pl-3 border-l-2 border-slate-100 ml-1">
                    {groupedFaults[dateStr].map((fault, index) => (
                      <div key={fault.id} className="text-sm">
                        <div className="flex justify-between items-center text-slate-500 mb-1">
                          <span className="font-medium text-slate-700">Lỗi {index + 1} ({fault.shiftName})</span>
                          <span>{format(new Date(fault.createdAt), "HH:mm")}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <p className="text-slate-600 whitespace-pre-wrap flex-1">
                            {fault.note || "Không có ghi chú"}
                          </p>
                          {fault.evidenceUrl && (
                            <a
                              href={fault.evidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline ml-4 whitespace-nowrap flex items-center"
                            >
                              <ImageIcon className="h-3 w-3 mr-1" />
                              Xem ảnh
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
