"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const features = [
  {
    title: "Tổng quan Dashboard",
    description: "Nắm bắt toàn bộ hoạt động kinh doanh và nhân sự của chuỗi cửa hàng trong chớp mắt. Báo cáo trực quan bằng biểu đồ giúp bạn đưa ra các quyết định vận hành chính xác.",
    image: "/features/dashboard.png",
  },
  {
    title: "Lịch xếp ca trực quan",
    description: "Theo dõi toàn bộ lịch làm việc của nhân sự qua giao diện lịch hiện đại, rõ ràng. Kéo thả để điều chỉnh thủ công dễ dàng, có thể xem theo tuần hoặc theo tháng.",
    image: "/features/lich-xep-ca.png",
  },
  {
    title: "Xếp ca tự động thông minh",
    description: "Tính năng nổi bật nhất của ApexFlow. Hệ thống AI tự động phân tích khung giờ rảnh của nhân viên và nội quy cửa hàng để tự động điền lịch làm việc, tiết kiệm hàng giờ đồng hồ mỗi tuần.",
    image: "/features/xep-ca-tu-dong.png",
  },
  {
    title: "Quản lý nhân viên chi tiết",
    description: "Hồ sơ nhân viên được lưu trữ tập trung. Nắm rõ số ca làm việc, mức độ chuyên cần, quỹ thời gian và vai trò của từng thành viên trong hệ thống tổ chức.",
    image: "/features/quan-li-nhan-vien.png",
  },
  {
    title: "Quản lý Đa chi nhánh",
    description: "Giải pháp hoàn hảo cho dạng chuỗi. Thêm mới, phân bổ nhân sự và cấu hình quy định hoạt động độc lập cho từng cửa hàng một cách mượt mà và bảo mật.",
    image: "/features/quan-li-cua-hang.png",
  },
];

export function MacbookScroll() {
  return (
    <div className="relative w-full bg-slate-50 py-24 overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-32 px-6 md:px-10">
        
        {features.map((feature, index) => {
          const isEven = index % 2 === 0;
          return (
            <div key={index} className={`flex flex-col gap-10 lg:items-center ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>
              
              {/* Text */}
              <div className="flex-1 flex flex-col gap-6 relative z-20">
                <h3 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                  {feature.title}
                </h3>
                <p className="text-lg text-slate-600 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>

              {/* Floating Image */}
              <div className="flex-1 relative z-10 w-full perspective-[1000px] mt-10 lg:mt-0">
                <motion.div
                  animate={{ y: [0, -15, 0] }}
                  transition={{ repeat: Infinity, duration: 4 + index * 0.5, ease: "easeInOut" }}
                  className="relative mx-auto w-full max-w-2xl rounded-2xl border border-slate-200/60 bg-white/50 p-2 shadow-2xl shadow-slate-200/50 backdrop-blur-xl"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <img src={feature.image} alt={feature.title} className="w-full h-full object-cover object-left-top" />
                  </div>
                </motion.div>
                
                {/* Ambient Glow */}
                <div className="absolute top-1/2 left-1/2 -z-10 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-cyan-400/20 via-fuchsia-400/20 to-blue-400/20 blur-[100px] pointer-events-none"></div>
              </div>

            </div>
          );
        })}

      </div>
    </div>
  );
}
