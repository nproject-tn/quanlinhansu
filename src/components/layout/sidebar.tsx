"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  Settings2,
  Users,
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
  const items = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <aside className="glass-control sticky top-4 flex h-[calc(100vh-2rem)] w-64 shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/65 bg-white/68 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="border-b border-white/45 px-6 py-5">
        <p className="text-sm font-semibold text-blue-600">Apexflow HR</p>
        <h1 className="text-lg font-bold text-slate-900">Quản lý nhân sự</h1>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50/90 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
                  : "text-slate-600 hover:bg-white/55 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/45 p-4">
        <div className="mb-3 rounded-2xl bg-white/45 px-3 py-3">
          <p className="text-sm font-medium text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
