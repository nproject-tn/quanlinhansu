"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Shield, Zap, BarChart, Users } from "lucide-react";
import { useState } from "react";
import { FindCompanyModal } from "@/components/auth/find-company-modal";
import { MacbookScroll } from "../components/macbook-scroll";

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-slate-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <div className="glass-control flex items-center justify-between rounded-full px-6 py-3 border border-white/60 bg-white/60 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/40">
            <div className="flex items-center gap-2">
              <img src="/logo-shape.svg" alt="ApexFlow" className="h-7 w-7 object-contain grayscale" />
              <span className="text-xl font-bold text-slate-900 tracking-tight">ApexFlow</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <Link href="#features" className="hover:text-slate-900 transition-colors">Tính năng</Link>
              <Link href="#solutions" className="hover:text-slate-900 transition-colors">Giải pháp</Link>
              <Link href="#pricing" className="hover:text-slate-900 transition-colors">Bảng giá</Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dang-nhap" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Đăng nhập</Link>
              <Link href="/dang-nhap" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/30 transition-all active:scale-95">
                Bắt đầu miễn phí
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-white"></div>
        
        {/* Colorful Aurora Glow behind Hero */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[400px] w-[80%] max-w-[800px] rounded-[100%] bg-gradient-to-r from-pink-300/40 via-purple-300/40 to-cyan-300/40 blur-[80px] mix-blend-multiply opacity-70 pointer-events-none animate-pulse duration-1000"></div>
        
        <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/50 bg-white/60 px-4 py-1.5 text-sm font-medium text-slate-700 backdrop-blur-md mb-8 animate-fade-in-up shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-slate-900 animate-pulse"></span>
            Phiên bản 2.0 đã ra mắt với Kiosk Chấm Công AI
          </div>
          
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl mb-8 animate-fade-in-up animation-delay-100">
            Hệ điều hành cho <br />
            <span className="text-slate-900">Đội ngũ Cửa hàng</span> của bạn.
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-slate-600 mb-10 animate-fade-in-up animation-delay-200">
            Từ xếp ca thông minh, chấm công bằng nhận diện khuôn mặt đến theo dõi doanh thu bán hàng tự động. Tất cả trong một nền tảng duy nhất.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
            <Link href="/dang-nhap" className="flex items-center gap-2 rounded-full bg-slate-900 px-8 py-4 text-base font-medium text-white shadow-xl shadow-slate-900/25 hover:bg-slate-800 hover:shadow-2xl hover:shadow-slate-900/40 transition-all hover:-translate-y-0.5 active:scale-95 w-full sm:w-auto justify-center">
              Tạo không gian làm việc
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="#demo" className="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md border border-slate-200 px-8 py-4 text-base font-medium text-slate-700 shadow-sm hover:bg-white hover:border-slate-300 transition-all active:scale-95 w-full sm:w-auto justify-center">
              Xem Demo
            </Link>
          </div>
          
          {/* Dashboard Preview Mockup is replaced by MacbookScroll below */}
        </div>
      </section>

      {/* Macbook Scroll Section */}
      <MacbookScroll />
      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Mọi thứ bạn cần để quản lý </h2>
            <p className="mt-4 text-lg text-slate-600">Được thiết kế cho các chuỗi bán lẻ, cửa hàng F&B và doanh nghiệp dịch vụ.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Users}
              title="Quản lý Đa Chi Nhánh"
              description="Dễ dàng tạo và quản lý nhiều cửa hàng, phân quyền cho quản lý từng chi nhánh, và quản lý toàn bộ nhân sự tại một nơi."
            />
            <FeatureCard 
              icon={Zap}
              title="Xếp Ca Tự Động"
              description="Hệ thống tự động gợi ý lịch làm việc dựa trên mức độ ưu tiên, quy tắc vận hành và số giờ làm việc tối đa của nhân viên."
            />
            <FeatureCard 
              icon={Shield}
              title="Chấm Công Face ID"
              description="Kiosk chấm công ứng dụng công nghệ nhận diện khuôn mặt AI ngay trên trình duyệt. Ngăn chặn gian lận thời gian."
            />
            <FeatureCard 
              icon={BarChart}
              title="Ghi Nhận Doanh Thu"
              description="Theo dõi doanh số của từng nhân viên theo từng ca làm. Tự động đồng bộ với TikTok Shop và Shopee."
            />
            <FeatureCard 
              icon={CheckCircle2}
              title="Duyệt Yêu Cầu Linh Hoạt"
              description="Nhân viên có thể gửi yêu cầu xin nghỉ, đổi ca, làm thêm giờ trực tiếp qua hệ thống cho quản lý phê duyệt."
            />
            <FeatureCard 
              icon={Users}
              title="Quản Lý Phân Quyền (RBAC)"
              description="Tuỳ biến quyền hạn chi tiết cho Admin, Scheduler và Nhân viên. Bảo mật dữ liệu tuyệt đối giữa các công ty."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 text-slate-400">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo-shape.svg" alt="ApexFlow" className="h-6 w-6 opacity-75 grayscale invert" />
              <span className="text-lg font-semibold text-slate-200">ApexFlow</span>
            </div>
            <p className="text-sm">© 2026 ApexFlow Inc. Bảo lưu mọi quyền.</p>
          </div>
        </div>
      </footer>

      <FindCompanyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-3 text-xl font-semibold text-slate-900">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
