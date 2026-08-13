import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth-actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function SignOutButton({ isCollapsed, companyId, className }: { isCollapsed?: boolean, companyId?: string, className?: string }) {
  if (companyId) {
    return (
      <Link
        href="/workspaces"
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-white/55 hover:text-slate-900 transition-colors duration-300",
          isCollapsed && "justify-center px-2",
          className
        )}
        title={isCollapsed ? "Đăng xuất" : undefined}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="whitespace-nowrap">Đăng xuất</span>}
      </Link>
    );
  }

  const handleSignOut = signOutAction.bind(null, undefined);
  return (
    <form action={handleSignOut}>
      <button
        type="submit"
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-white/55 hover:text-slate-900 transition-colors duration-300",
          isCollapsed && "justify-center px-2",
          className
        )}
        title={isCollapsed ? "Đăng xuất" : undefined}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="whitespace-nowrap">Đăng xuất</span>}
      </button>
    </form>
  );
}
