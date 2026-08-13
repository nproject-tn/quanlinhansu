"use client";

import React from "react";
import { Construction, ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface UnderDevelopmentGuardProps {
  userEmail?: string | null;
  featureName?: string;
  children: React.ReactNode;
  fallbackType?: "page" | "modal" | "inline";
}

const SUPER_ADMIN_EMAIL = "thanhnamnguyen16091999@gmail.com";

export function UnderDevelopmentGuard({
  userEmail,
  featureName = "Tính năng này",
  children,
  fallbackType = "page",
}: UnderDevelopmentGuardProps) {
  // Chuẩn hóa email để so sánh chính xác
  const isSuperAdmin = userEmail?.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  // Nếu là tài khoản Admin thanhnamnguyen16091999@gmail.com => Mở toàn bộ quyền test
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Nếu là TẤT CẢ các tài khoản khác => Chặn và hiển thị thông báo "Tính năng đang được phát triển"
  if (fallbackType === "inline") {
    return (
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 flex items-center gap-3 text-sm font-medium shadow-sm">
        <Construction className="h-5 w-5 text-amber-600 shrink-0 animate-bounce" />
        <div>
          <span className="font-bold">{featureName}</span> đang trong quá trình nâng cấp & hoàn thiện. Vui lòng quay lại sau!
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="absolute -inset-2 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
        <div className="relative h-20 w-20 rounded-3xl bg-slate-900 flex items-center justify-center text-amber-400 shadow-xl border border-slate-800">
          <Construction className="h-10 w-10 animate-bounce" />
        </div>
      </div>

      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-100/80 border border-amber-200 text-amber-800 text-xs font-bold mb-3">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span>TÍNH NĂNG ĐANG ĐƯỢC PHÁT TRIỂN</span>
      </div>

      <h2 className="text-2xl font-black text-slate-900 tracking-tight max-w-md">
        {featureName} chưa sẵn sàng
      </h2>
      <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed">
        Đội ngũ kỹ thuật đang tích cực hoàn thiện {featureName.toLowerCase()} để mang lại trải nghiệm tốt nhất. Hiện tại tính năng đang tạm khóa đối với các tài khoản thông thường.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="rounded-xl font-semibold border-slate-200 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại
        </Button>
        <Link href="/app">
          <Button className="rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md">
            Về Trang chủ
          </Button>
        </Link>
      </div>
    </div>
  );
}
