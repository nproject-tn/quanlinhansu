"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNotifications } from "@/components/notifications/notification-center";
import { Upload, X, Loader2 } from "lucide-react";

export function CompanySettings({ companyId, canEdit }: { companyId: string, canEdit: boolean }) {
  const { notify } = useNotifications();
  const [uploading, setUploading] = useState(false);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load");
    return res.json();
  };

  const { data: company, mutate } = useSWR(`/api/settings/company`, fetcher);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Upload to server (or S3)
      const uploadRes = await fetch("/api/upload/s3", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Lỗi tải ảnh lên");
      }

      const { url } = await uploadRes.json();

      // Save logo URL to company settings
      const saveRes = await fetch(`/api/settings/company`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: url }),
      });

      if (!saveRes.ok) throw new Error("Lỗi lưu logo");

      notify({ tone: "success", title: "Thành công", body: "Đã cập nhật logo doanh nghiệp" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async (e: React.MouseEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const saveRes = await fetch(`/api/settings/company`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: null }),
      });

      if (!saveRes.ok) throw new Error("Lỗi xoá logo");

      notify({ tone: "success", title: "Thành công", body: "Đã xoá logo doanh nghiệp" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setUploading(false);
    }
  };

  if (!company) return null;

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white/80 glass-control">
      <CardHeader className="bg-slate-50/50 border-b pb-4">
        <CardTitle>Thông tin doanh nghiệp</CardTitle>
        <CardDescription>Cập nhật logo và tên doanh nghiệp (hiển thị trên Sidebar).</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex items-center gap-6">
          <div className="relative group/logo">
            <div className="h-24 w-24 rounded-2xl bg-indigo-50 border border-slate-200 flex items-center justify-center overflow-hidden">
              {uploading ? (
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
              ) : company.logo ? (
                <img src={company.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-indigo-300 uppercase">{company.name.charAt(0)}</span>
              )}
            </div>
            {canEdit && (
              <>
                <label className="absolute inset-0 bg-black/50 text-white rounded-2xl opacity-0 group-hover/logo:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity">
                  <Upload className="h-6 w-6 mb-1" />
                  <span className="text-xs font-medium">Đổi Logo</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleUploadLogo}
                    disabled={uploading}
                  />
                </label>
                {company.logo && (
                  <button
                    type="button"
                    title="Xoá logo"
                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover/logo:opacity-100 transition-opacity hover:bg-red-500 hover:text-white shadow-sm border border-red-200 z-10"
                    onClick={handleDeleteLogo}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{company.name}</h3>
            <p className="text-sm text-slate-500">Workspace ID: {company.id}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
