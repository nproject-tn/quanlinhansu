"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  Settings2,
  Users,
  Package,
  PanelLeft,
  Menu,
  X,
  Settings,
  ChevronDown,
  ChevronRight,
  Truck,
  Layers,
  Boxes,
  Crown,
  ShoppingBag,
} from "lucide-react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBellTrigger } from "@/components/notifications/notification-bell-trigger";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

type SubNavItem = {
  href: string;
  label: string;
  tabKey: string;
  icon: typeof Package;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  permissionKey?: string;
  subItems?: SubNavItem[];
};

const navItems: NavItem[] = [
  { href: "/app", label: "Tổng quan", icon: LayoutDashboard, roles: ["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"] },
  { href: "/app/cua-hang", label: "Cửa hàng", icon: Building2, roles: ["OWNER", "ADMIN"], permissionKey: "store" },
  {
    href: "/app/hang-hoa",
    label: "Hàng hoá",
    icon: Package,
    roles: ["OWNER", "ADMIN", "SCHEDULER"],
    permissionKey: "products",
    subItems: [
      { href: "/app/hang-hoa?tab=import", label: "Nhập hàng", tabKey: "import", icon: Truck },
      { href: "/app/hang-hoa?tab=products", label: "Sản phẩm", tabKey: "products", icon: Layers },
      { href: "/app/hang-hoa?tab=inventory", label: "Tồn kho", tabKey: "inventory", icon: Boxes },
    ],
  },
  { href: "/app/don-hang", label: "Đơn hàng", icon: ShoppingBag, roles: ["OWNER", "ADMIN", "SCHEDULER"], permissionKey: "revenue" },
  { href: "/app/nhan-vien", label: "Nhân viên", icon: Users, roles: ["OWNER", "ADMIN", "SCHEDULER"], permissionKey: "employees" },
  { href: "/app/cau-hinh-ca", label: "Cấu hình ca", icon: Settings2, roles: ["OWNER", "ADMIN"], permissionKey: "shift_config" },
  { href: "/app/lich-xep-ca", label: "Lịch xếp ca", icon: CalendarDays, roles: ["OWNER", "ADMIN", "SCHEDULER", "EMPLOYEE"], permissionKey: "schedule" },
];

type SidebarProps = {
  companyId: string;
  user: {
    name: string;
    email: string;
    role: UserRole;
    permissions?: any;
    pendingTransfer?: any;
  };
};

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={null}>
      <SidebarContent {...props} />
    </Suspense>
  );
}

function SidebarContent({ user, companyId }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "products";

  const isHangHoaRoute = pathname.includes("/hang-hoa");
  const [isHangHoaOpen, setIsHangHoaOpen] = useState(isHangHoaRoute);

  useEffect(() => {
    if (isHangHoaRoute) {
      setIsHangHoaOpen(true);
    }
  }, [isHangHoaRoute]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const items = navItems.filter((item) => {
    if (user.role === "OWNER") return true;
    if (item.permissionKey) {
      return hasPermission(user.role, user.permissions, item.permissionKey, "VIEW");
    }
    return item.roles.includes(user.role);
  }).map(item => ({
    ...item,
    href: `/app/${companyId}${item.href === "/app" ? "" : item.href.replace("/app", "")}`,
    subItems: item.subItems?.map(sub => ({
      ...sub,
      href: `/app/${companyId}${sub.href.replace("/app", "")}`
    }))
  }));

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl glass-control border border-white/65 bg-white/68 shadow-sm backdrop-blur-xl text-slate-700 active:scale-95 transition-all dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-200"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-[80] bg-slate-900/30 backdrop-blur-sm transition-opacity dark:bg-black/75"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "glass-control flex h-[calc(100vh-2rem)] shrink-0 flex-col rounded-[28px] border border-white/65 bg-white/68 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-[width,transform,opacity] duration-300 ease-in-out max-md:z-[90] md:z-40 dark:border-[#333333] dark:bg-[#181818]/95 dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
          "max-md:fixed max-md:top-4 max-md:left-4 md:sticky md:top-4",
          !isMobileOpen && "max-md:-translate-x-[150%] max-md:w-64 max-md:opacity-0", 
          isMobileOpen && "max-md:translate-x-0 max-md:w-[calc(100vw-2rem)] max-md:max-w-[18rem] max-md:opacity-100",
          isCollapsed ? "md:w-[5.5rem] md:overflow-visible" : "md:w-64 overflow-hidden"
        )}
      >
        <div className="relative flex h-20 items-center justify-between border-b border-white/45 px-5 dark:border-[#333333]/80">
        <div
          className={cn(
            "flex flex-col overflow-hidden whitespace-nowrap transition-all duration-300",
            isCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"
          )}
        >
          <img src="/logo-text.svg" alt="Apexflow HR" className="h-[14px] mt-2.5 w-auto object-contain object-left mb-0.5 dark:brightness-0 dark:invert" />
          <h1 className="text-sm font-medium text-slate-500 dark:text-[#9D9D9D]">Quản lý nhân sự</h1>
        </div>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "hidden md:flex absolute h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-[#9D9D9D] dark:hover:bg-[#252526] dark:hover:text-white",
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

        {/* Close Button for Mobile */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-[#9D9D9D] dark:hover:bg-[#252526] dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className={cn("flex-1 space-y-1 p-4 overflow-y-auto overflow-x-hidden", isCollapsed && "md:overflow-visible")}>
        {items.map((item) => {
          const Icon = item.icon;
          const isHangHoa = item.href.includes("/hang-hoa");
          const active = isHangHoa ? isHangHoaRoute : pathname === item.href;

          if (item.subItems && item.subItems.length > 0) {
            return (
              <div key={item.href} className="space-y-1">
                {/* Desktop Collapsed Version with Flyout */}
                {isCollapsed && (
                  <div className="hidden md:block relative group/collapsedSub font-sans">
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "flex items-center justify-center gap-3 rounded-2xl px-2 py-3 text-sm font-medium transition-colors duration-300",
                        active
                          ? "bg-slate-200/50 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md dark:bg-[#2D2D30] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "text-slate-600 hover:bg-white/55 hover:text-slate-900 dark:text-[#9D9D9D] dark:hover:bg-[#252526] dark:hover:text-white"
                      )}
                      title={item.label}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                    </Link>

                    {/* Floating Flyout Submenu */}
                    <div className="pointer-events-none opacity-0 group-hover/collapsedSub:pointer-events-auto group-hover/collapsedSub:opacity-100 transition-all duration-200 delay-300 group-hover/collapsedSub:delay-0 ease-out absolute left-full top-0 ml-2.5 w-52 rounded-2xl bg-white/95 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.15)] p-2 z-[100] border border-slate-200/80 backdrop-blur-xl before:absolute before:-left-5 before:top-0 before:bottom-0 before:w-6 dark:bg-[#252526] dark:text-[#E0E0E0] dark:border-[#333333] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                      <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-[#333333] mb-1 flex items-center justify-between">
                        <span>{item.label}</span>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      </div>
                      {item.subItems.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = isHangHoaRoute && (
                          currentTab === sub.tabKey || (!searchParams.get("tab") && sub.tabKey === "products")
                        );

                        return (
                          <Link
                            key={sub.tabKey}
                            href={sub.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-all my-0.5",
                              isSubActive
                                ? "bg-slate-900 text-white font-bold shadow-sm dark:bg-white dark:text-neutral-900"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium dark:text-[#9D9D9D] dark:hover:bg-[#2D2D30] dark:hover:text-white"
                            )}
                          >
                            <SubIcon className={cn("h-4 w-4 shrink-0", isSubActive ? "text-white dark:text-neutral-900" : "text-slate-500 dark:text-[#9D9D9D]")} />
                            <span>{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Normal & Mobile Accordion Version */}
                <div className={cn("space-y-1", isCollapsed && "md:hidden")}>
                  <div
                    onClick={() => {
                      if (!isHangHoaRoute) {
                        setIsHangHoaOpen(true);
                      } else {
                        setIsHangHoaOpen(!isHangHoaOpen);
                      }
                    }}
                    className={cn(
                      "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 cursor-pointer select-none active:scale-[0.99]",
                      active
                        ? "bg-slate-200/50 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md font-semibold dark:bg-[#2D2D30] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-[#9D9D9D] dark:hover:bg-[#252526] dark:hover:text-white"
                    )}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <Icon className="h-5 w-5 shrink-0 group-hover:scale-105 transition-transform duration-200" />
                      <span className="whitespace-nowrap truncate">{item.label}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsHangHoaOpen(!isHangHoaOpen);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform duration-300 ease-in-out",
                        isHangHoaOpen && "rotate-90 text-slate-900 dark:text-white font-bold"
                      )} />
                    </button>
                  </div>

                  {/* Sub-items accordion dropdown with smooth transition */}
                  <div className={cn(
                    "ml-5 border-l-2 border-slate-200 dark:border-[#333333] pl-2.5 space-y-1 overflow-hidden transition-all duration-300 ease-in-out",
                    isHangHoaOpen ? "max-h-48 opacity-100 my-1" : "max-h-0 opacity-0 my-0"
                  )}>
                    {item.subItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = isHangHoaRoute && (
                        currentTab === sub.tabKey || (!searchParams.get("tab") && sub.tabKey === "products")
                      );
                      return (
                        <Link
                          key={sub.tabKey}
                          href={sub.href}
                          onClick={() => setIsMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors duration-150",
                            isSubActive
                              ? "bg-slate-900 text-white font-semibold shadow-sm dark:bg-white dark:text-neutral-900"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium dark:text-[#9D9D9D] dark:hover:bg-[#2D2D30] dark:hover:text-white"
                          )}
                        >
                          <SubIcon className={cn("h-3.5 w-3.5 shrink-0", isSubActive ? "text-white dark:text-neutral-900" : "text-slate-500 dark:text-[#9D9D9D]")} />
                          <span>{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-300",
                active
                  ? "bg-slate-200/50 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md dark:bg-[#2D2D30] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-slate-600 hover:bg-white/55 hover:text-slate-900 dark:text-[#9D9D9D] dark:hover:bg-[#252526] dark:hover:text-white",
                isCollapsed && "md:justify-center md:px-2"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={cn("whitespace-nowrap", isCollapsed && "md:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-2 relative z-10">
        {(user.role === "OWNER" || hasPermission(user.role, user.permissions, "settings", "VIEW") || hasPermission(user.role, user.permissions, "settings", "EDIT") || !!user.pendingTransfer) && (
          <Link
            href={`/app/${companyId}/cai-dat`}
            onClick={() => setIsMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors duration-300",
              pathname === `/app/${companyId}/cai-dat`
                ? "bg-slate-200/50 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md dark:bg-[#2D2D30] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "text-slate-600 hover:bg-white/55 hover:text-slate-900 dark:text-[#9D9D9D] dark:hover:bg-[#252526] dark:hover:text-white",
              isCollapsed && "md:justify-center md:px-2"
            )}
            title={isCollapsed ? "Cài đặt & Phân quyền" : undefined}
          >
            <div className="relative flex items-center justify-center shrink-0">
              <Settings className="h-5 w-5 shrink-0" />
              {!!user.pendingTransfer && isCollapsed && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 ring-2 ring-white dark:ring-[#181818]"></span>
                </span>
              )}
            </div>
            <div className={cn("flex items-center justify-between min-w-0 flex-1 gap-1.5", isCollapsed && "md:hidden")}>
              <span className="truncate">Cài đặt & Phân quyền</span>
              {!!user.pendingTransfer && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 shrink-0 shadow-xs">
                  <Crown className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  Lời mời
                </span>
              )}
            </div>
          </Link>
        )}
      </div>

      <div className="border-t border-white/45 p-4 relative z-10 dark:border-[#333333]/80">
        <div className={cn(
          "mb-3 flex items-center gap-3 rounded-2xl bg-white/40 p-2.5 shadow-sm transition-all duration-300 dark:bg-[#222224] dark:border dark:border-[#333333]",
          isCollapsed ? "md:justify-center md:p-1 md:bg-transparent md:dark:bg-transparent md:dark:border-0 md:shadow-none" : ""
        )}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-sm font-semibold text-white shadow-md dark:from-[#333338] dark:to-[#252528]">
            {user.name.charAt(0)}
          </div>
          <div className={cn("flex flex-col min-w-0 flex-1", isCollapsed && "md:hidden")}>
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.name}</span>
            <span className="truncate text-xs text-slate-500 dark:text-[#9D9D9D]">{ROLE_LABELS[user.role]}</span>
          </div>
        </div>

        {/* Bottom Actions - Always horizontal on mobile, responsive to isCollapsed on desktop */}
        <div className={cn("items-center justify-between gap-1 w-full pt-1", isCollapsed ? "flex md:hidden" : "flex")}>
          <div className="flex-1 min-w-0">
            <SignOutButton isCollapsed={false} companyId={companyId} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBellTrigger isCollapsed={false} companyId={companyId} userRole={user.role} permissions={user.permissions} />
            <ThemeToggle isCollapsed={false} align="center" side="top" />
            <WorkspaceSwitcher currentCompanyId={companyId} isCollapsed={false} />
          </div>
        </div>
        {isCollapsed && (
          <div className="hidden md:flex flex-col items-center gap-2.5 w-full pt-1">
            <NotificationBellTrigger isCollapsed={true} companyId={companyId} userRole={user.role} permissions={user.permissions} />
            <ThemeToggle isCollapsed={true} align="end" side="right" />
            <WorkspaceSwitcher currentCompanyId={companyId} isCollapsed={true} />
            <SignOutButton isCollapsed={true} companyId={companyId} />
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
