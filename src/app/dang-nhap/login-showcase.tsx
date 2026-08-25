"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  Package,
  Factory,
  BarChart3,
  Sparkles,
  Layers,
  CheckCircle2,
  TrendingUp,
  Cpu,
} from "lucide-react";

interface ShowcaseTab {
  id: string;
  label: string;
  tag: string;
  title: string;
  description: string;
  icon: any;
  cardContent: React.ReactNode;
}

export function LoginShowcase() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs: ShowcaseTab[] = [
    {
      id: "overview",
      label: "TỔNG QUAN",
      tag: "HỆ ĐIỀU HÀNH BÁN LẺ THỜI TRANG",
      title: "Nền tảng Vận hành Chuỗi Cung ứng & Quản trị Nhân sự",
      description:
        "Tích hợp toàn diện từ lập lịch xếp ca thông minh, chuẩn hóa SKU 8 ký tự, đơn xưởng PO đến kiểm định QC thời gian thực.",
      icon: Layers,
      cardContent: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">ApexFlow Enterprise OS</div>
                <div className="text-[10px] text-slate-400">Multi-tenant Cloud Architecture</div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
              ● Live Sync
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
              <div className="text-[11px] text-slate-400">Tỷ lệ điền ca làm</div>
              <div className="text-xl font-bold font-mono text-white">99.2%</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <TrendingUp className="h-3 w-3" /> +14% hiệu suất
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
              <div className="text-[11px] text-slate-400">Tồn kho SKU đồng bộ</div>
              <div className="text-xl font-bold font-mono text-white">100%</div>
              <div className="text-[10px] text-indigo-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3" /> EAN-8 Barcodes
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "schedule",
      label: "XẾP CA AI",
      tag: "SMART SHIFT BALANCING",
      title: "Thuật toán Tự động Lập Lịch Ca làm việc Thông minh",
      description:
        "Tự động tính toán công bằng giờ làm, hạn chế ca gãy, kiểm soát làm thêm overtime và hỗ trợ nhân viên xin đổi ca tức thì.",
      icon: CalendarDays,
      cardContent: (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <Cpu className="h-4 w-4 text-indigo-400" /> Phân bổ nhân sự Tuần 34
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">0 lỗi vi phạm</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-[10px] font-bold flex items-center justify-center text-white">
                  TN
                </div>
                <span className="text-xs text-white font-medium">Thanh Nam (Cửa hàng trưởng)</span>
              </div>
              <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                Ca Sáng (08:00 - 16:00)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-[10px] font-bold flex items-center justify-center text-white">
                  HA
                </div>
                <span className="text-xs text-white font-medium">Hoàng Anh (Thu ngân)</span>
              </div>
              <span className="text-[10px] font-semibold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">
                Ca Chiều (14:30 - 22:30)
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "sku",
      label: "HÀNG HÓA & SKU",
      tag: "FASHION SKU 8-CHAR ENGINE",
      title: "Định danh SKU 8 Ký tự & Phân cụm Màu sắc Chuyên sâu",
      description:
        "Tự động sinh mã SKU chuẩn công nghiệp 8 ký tự, phân tách theo cụm màu sắc và đồng bộ mã vạch EAN-8 cho máy quét cầm tay.",
      icon: Package,
      cardContent: (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-500/20 space-y-1.5">
            <div className="text-[11px] text-slate-300 font-medium">Mã SKU Chuẩn 8 ký tự:</div>
            <div className="text-xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-200 to-pink-300 tracking-wider">
              VX010605
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              [V: Áo][X: Thun giấy][01: Dak rad][06: Vàng][05: Size XL]
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300 font-mono">
              Cluster: VX0106xx (Vàng)
            </span>
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-slate-300 font-mono">
              Cluster: VX0101xx (Trắng)
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "qc",
      label: "ĐẶT XƯỞNG QC",
      tag: "FACTORY ORDERS & QC CONTROL",
      title: "Quản lý Đơn Xưởng PO & Kiểm Thử Đạt Chuẩn QC Pass",
      description:
        "Theo dõi chu trình đặt xưởng may, nghiệm thu chất lượng theo từng size và tự động cộng dồn số lượng thực tế vào sổ kho.",
      icon: Factory,
      cardContent: (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-bold text-white">Đơn Xưởng PO-2026-088</span>
            <span className="text-emerald-400 font-semibold text-[11px] bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
              QC Passed 100%
            </span>
          </div>

          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full w-full" />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>Xưởng may: Hoàng Gia Garment</span>
            <span className="font-mono text-white font-bold">500 / 500 cái</span>
          </div>
        </div>
      ),
    },
    {
      id: "analytics",
      label: "BÁO CÁO",
      tag: "REAL-TIME METRICS",
      title: "Báo cáo Doanh thu, Chi phí & Nhân sự Đa Chi nhánh",
      description:
        "Thống kê trực quan giờ làm thực tế, biến động tồn kho và hiệu suất bán hàng trên một bảng điều khiển tập trung.",
      icon: BarChart3,
      cardContent: (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Báo cáo Tháng 08/2026</span>
            <span className="text-[11px] font-mono text-indigo-400">Toàn hệ thống</span>
          </div>

          <div className="h-16 flex items-end gap-2 pt-2">
            {[40, 65, 80, 55, 90, 75, 100].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gradient-to-t from-indigo-600 to-purple-400 rounded-t"
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/10 pt-1.5 font-mono">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span className="text-indigo-400 font-bold">CN</span>
          </div>
        </div>
      ),
    },
  ];

  // Auto-switch tabs every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % tabs.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [tabs.length]);

  const current = tabs[activeTab];

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-[#06080e] via-[#0d121f] to-[#04060b] p-6 lg:p-8 xl:p-10 text-white flex flex-col justify-between overflow-hidden">
      {/* Ambient background glow & radial lights */}
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-purple-600/20 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      {/* Top Brand Tag */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo-shape.svg"
            alt="ApexFlow"
            className="h-8 w-8 lg:h-9 lg:w-9 object-contain drop-shadow-md"
          />
          <div>
            <div className="text-sm lg:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              ApexFlow <span className="text-indigo-400 font-mono text-xs font-normal">v3.4</span>
            </div>
            <div className="text-[10px] lg:text-[11px] text-slate-400 font-medium">Enterprise Fashion Retail ERP</div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-300 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Hệ thống sẵn sàng</span>
        </div>
      </div>

      {/* Center 3D Showcase Card */}
      <div className="relative z-10 my-3 lg:my-4 space-y-3 lg:space-y-4">
        {/* Floating Highlight Card */}
        <div className="rounded-xl lg:rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-xl p-4 lg:p-5 shadow-2xl space-y-3 transform transition-all duration-500 hover:scale-[1.01]">
          {current.cardContent}
        </div>

        {/* Feature Title & Text */}
        <div className="space-y-1.5 animate-in fade-in duration-300">
          <div className="text-[10px] lg:text-[11px] font-mono font-bold tracking-widest text-indigo-400 uppercase">
            {current.tag}
          </div>
          <h2 className="text-base lg:text-lg xl:text-xl font-bold text-white tracking-tight leading-snug">
            {current.title}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-lg line-clamp-2 lg:line-clamp-3">
            {current.description}
          </p>
        </div>
      </div>

      {/* Bottom Interactive Navigation Tabs */}
      <div className="relative z-10 space-y-2.5 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {tabs.map((tab, idx) => {
            const isActive = idx === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`text-[10px] lg:text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? "text-white bg-white/15 border border-white/20 shadow-sm"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${((activeTab + 1) / tabs.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
