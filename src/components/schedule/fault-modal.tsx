"use client";

import { useState, useRef } from "react";
import { X, Plus, Trash2, Pencil, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import imageCompression from "browser-image-compression";

type FaultModalProps = {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  shiftName: string;
  faults?: { id: string; note: string | null; evidenceUrl?: string | null; createdAt?: Date | string }[];
  onAddFault: (note: string, evidenceUrl?: string, time?: string) => Promise<void>;
  onEditFault: (id: string, note: string, evidenceUrl?: string, time?: string) => Promise<void>;
  onDeleteFault: (id: string) => Promise<void>;
  readOnly?: boolean;
};

export function FaultModal({
  isOpen,
  onClose,
  employeeName,
  shiftName,
  faults = [],
  onAddFault,
  onEditFault,
  onDeleteFault,
  readOnly = false,
}: FaultModalProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [note, setNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [faultTime, setFaultTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      
      // Nén ảnh trước khi upload
      const options = {
        maxSizeMB: 0.2, // Tối đa 200KB
        maxWidthOrHeight: 1024, // Giữ nguyên tỉ lệ, chỉ resize cạnh dài nhất về 1024px
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      const formData = new FormData();
      formData.append("file", compressedFile, file.name);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Lỗi không xác định từ server");
      }
      const data = await res.json();
      setEvidenceUrl(data.url);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Lỗi tải ảnh lên");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStartAdd = () => {
    setNote("");
    setEvidenceUrl(null);
    setEditId(null);
    setFaultTime(format(new Date(), "HH:mm"));
    setShowAdd(true);
  };

  const handleStartEdit = (fault: any) => {
    setNote(fault.note || "");
    setEvidenceUrl(fault.evidenceUrl || null);
    setFaultTime(fault.createdAt ? format(new Date(fault.createdAt), "HH:mm") : format(new Date(), "HH:mm"));
    setEditId(fault.id);
    setShowAdd(false);
  };

  const handleCancelForm = () => {
    setShowAdd(false);
    setEditId(null);
    setNote("");
    setEvidenceUrl(null);
    setFaultTime("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() && !evidenceUrl) return;

    try {
      setLoading(true);
      if (editId) {
        await onEditFault(editId, note, evidenceUrl || undefined, faultTime);
      } else {
        await onAddFault(note, evidenceUrl || undefined, faultTime);
      }
      handleCancelForm();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      await onDeleteFault(id);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-sm max-h-[90vh] flex flex-col shadow-lg animate-in fade-in-0 zoom-in-95">
        <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
          <CardTitle className="text-lg font-semibold">
            {readOnly ? "Chi tiết lỗi" : "Ghi nhận lỗi"}
          </CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </CardHeader>

        <CardContent className="px-6 pb-4 flex-1 overflow-y-auto">
          {!readOnly && (
            <p className="text-sm text-slate-500 mb-4">
              Lỗi của <strong>{employeeName}</strong> trong <strong>{shiftName}</strong>
            </p>
          )}

          <div className="space-y-3 mb-4">
            {faults.length === 0 && !showAdd && !editId && (
              <p className="text-sm text-slate-400 italic text-center py-4">Chưa có lỗi nào được ghi nhận.</p>
            )}
            
            {faults.map((fault, index) => {
              if (editId === fault.id) return null;
              return (
                <div key={fault.id} className="p-3 bg-red-50 text-red-900 rounded-md border border-red-100 text-sm group">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-xs text-red-700">
                      Lỗi số {index + 1}
                      {fault.createdAt && (
                        <span className="font-normal text-[10px] text-red-500 ml-1">
                          ({format(new Date(fault.createdAt), "HH:mm")})
                        </span>
                      )}
                    </p>
                    {!readOnly && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleStartEdit(fault)} className="p-1 text-red-600 hover:bg-red-100 rounded">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDelete(fault.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" disabled={loading}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-start mt-1">
                    <p className="whitespace-pre-wrap flex-1">{fault.note || "Không có ghi chú"}</p>
                    {fault.evidenceUrl && (
                      <a
                        href={fault.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline ml-3 whitespace-nowrap flex items-center"
                      >
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Xem ảnh
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!readOnly && (showAdd || editId) ? (
            <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-slate-700">
                  {editId ? "Sửa lỗi" : `Lỗi số ${faults.length + 1}`}
                </p>
                <input
                  type="time"
                  value={faultTime}
                  onChange={(e) => setFaultTime(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs shadow-sm bg-transparent"
                  disabled={loading || uploading}
                  required
                />
              </div>
              
              <textarea
                placeholder="Nhập ghi chú lỗi..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || uploading}
                autoFocus
              />

              <div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleUploadImage}
                />
                
                {evidenceUrl ? (
                  <div className="relative inline-block mt-2">
                    <img src={evidenceUrl} alt="Preview" className="h-20 w-20 object-cover rounded border" />
                    <button
                      type="button"
                      onClick={() => setEvidenceUrl(null)}
                      className="absolute -top-2 -right-2 bg-white rounded-full shadow p-0.5 border text-slate-500 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    disabled={uploading || loading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <ImageIcon className="h-3 w-3 mr-2" />}
                    Thêm ảnh bằng chứng
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelForm}
                  disabled={loading || uploading}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || uploading || (!note.trim() && !evidenceUrl)}
                >
                  {loading ? "Đang xử lý..." : "Lưu"}
                </Button>
              </div>
            </form>
          ) : !readOnly ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={handleStartAdd}
            >
              <Plus className="h-4 w-4 mr-2" />
              Thêm Lỗi
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
