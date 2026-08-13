"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findCompany } from "@/app/actions/find-company";

export function FindCompanyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const result = await findCompany(null, formData);
    setIsPending(false);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success && result.companyId) {
      onClose();
      router.push(`/dang-nhap/${encodeURIComponent(result.companyId)}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">Tìm Không gian làm việc</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <p className="text-slate-600 mb-6 text-sm">
            Vui lòng nhập tên Cửa hàng / Công ty của bạn để tiếp tục đến trang đăng nhập.
          </p>

          <form action={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">
                Tên cửa hàng
              </label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                placeholder="Ví dụ: Tokyolife HCM"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
                autoFocus
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-70 flex justify-center items-center"
            >
              {isPending ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                "Tiếp tục"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
