"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  Settings2,
  Users,
  PanelLeft,
} from "lucide-react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/utils";
import type { UserRole } from "@/generated/prisma/client";

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}[] = [
    { href: "/", label: "Tổng quan", icon: LayoutDashboard, roles: ["ADMIN", "SCHEDULER", "EMPLOYEE"] },
    { href: "/cua-hang", label: "Cửa hàng", icon: Building2, roles: ["ADMIN"] },
    { href: "/nhan-vien", label: "Nhân viên", icon: Users, roles: ["ADMIN", "SCHEDULER"] },
    { href: "/cau-hinh-ca", label: "Cấu hình ca", icon: Settings2, roles: ["ADMIN"] },
    { href: "/lich-xep-ca", label: "Lịch xếp ca", icon: CalendarDays, roles: ["ADMIN", "SCHEDULER", "EMPLOYEE"] },
  ];

type SidebarProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
};

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const items = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <aside
      className={cn(
        "glass-control sticky top-4 flex h-[calc(100vh-2rem)] shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/65 bg-white/68 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-[width] duration-300",
        isCollapsed ? "w-[5.5rem]" : "w-64"
      )}
    >
      <div className="relative flex h-20 items-center justify-between border-b border-white/45 px-5">
        <div
          className={cn(
            "flex flex-col overflow-hidden whitespace-nowrap transition-all duration-300",
            isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          <img src="/logo-text.svg" alt="Apexflow HR" className="h-[14px] mt-2.5 w-auto object-contain object-left mb-0.5" />
          <h1 className="text-sm font-medium text-slate-500">Quản lý nhân sự</h1>
        </div>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "absolute flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
            isCollapsed ? "right-1/2 translate-x-1/2" : "right-3"
          )}
          title={isCollapsed ? "Mở rộng" : "Thu nhỏ"}
        >
          {isCollapsed ? (
            <img src="/logo-shape.svg" alt="Apexflow" className="h-6 w-6 object-contain" />
          ) : (
            <PanelLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto overflow-x-hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-300",
                active
                  ? "bg-blue-50/90 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
                  : "text-slate-600 hover:bg-white/55 hover:text-slate-900",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/45 p-4">
        {!isCollapsed && (
          <div className="mb-3 rounded-2xl bg-white/45 px-3 py-3">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
          </div>
        )}
        <SignOutButton isCollapsed={isCollapsed} />
      </div>
    </aside>
  );
}
