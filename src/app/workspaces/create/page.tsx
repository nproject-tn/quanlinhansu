"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ArrowLeft, Loader2, ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { createWorkspaceAction } from "./actions";

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    try {
      await createWorkspaceAction(formData);
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 -left-64 h-[500px] w-[500px] rounded-full bg-slate-300/20 blur-[120px] mix-blend-multiply pointer-events-none"></div>
      <div className="absolute bottom-0 -right-64 h-[500px] w-[500px] rounded-full bg-slate-200/20 blur-[120px] mix-blend-multiply pointer-events-none"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/workspaces" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 mb-6 group">
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Quay lại danh sách
        </Link>
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/40 sm:rounded-2xl sm:px-10 border border-slate-100">
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tạo doanh nghiệp mới</h2>
            <p className="mt-2 text-sm text-slate-500">
              Bắt đầu quản lý chuỗi cửa hàng và lịch làm việc của bạn
            </p>
          </div>

          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="relative group">
                <label htmlFor="logo" className="cursor-pointer block">
                  <div className="h-20 w-20 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden transition-all group-hover:border-indigo-300 group-hover:shadow-md">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus className="h-8 w-8 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-slate-200">
                    <div className="bg-indigo-600 rounded-full p-1 text-white">
                      <ImagePlus className="h-3 w-3" />
                    </div>
                  </div>
                  <input 
                    type="file" 
                    id="logo" 
                    name="logo" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setLogoPreview(url);
                      }
                    }}
                  />
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    title="Xoá logo"
                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white shadow-sm border border-red-200 z-10"
                    onClick={(e) => {
                      e.preventDefault();
                      setLogoPreview(null);
                      const input = document.getElementById('logo') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <span className="text-xs text-slate-500 mt-3 font-medium">Thêm logo doanh nghiệp (Tùy chọn)</span>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Tên doanh nghiệp
              </label>
              <div className="mt-2">
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Ví dụ: TokyoLife HCM"
                  className="block w-full rounded-xl"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full justify-center bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Khởi tạo doanh nghiệp
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
