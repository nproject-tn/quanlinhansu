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
  { href: "/nhan-vien", label: "Nhân viên", icon: Users, roles: ["ADMIN"] },
  { href: "/cua-hang", label: "Cửa hàng", icon: Building2, roles: ["ADMIN"] },
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
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-6 py-5">
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
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-sm font-medium text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
