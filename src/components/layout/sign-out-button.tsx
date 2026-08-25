import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth-actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function SignOutButton({
  isCollapsed,
  companyId,
  className,
}: {
  isCollapsed?: boolean;
  companyId?: string;
  className?: string;
}) {
  const commonClasses = cn(
    "flex items-center text-slate-600 hover:text-slate-900 transition-all duration-300 dark:text-[#9D9D9D] dark:hover:text-white",
    isCollapsed
      ? "h-9 w-9 shrink-0 justify-center rounded-xl hover:bg-slate-200/50 dark:hover:bg-[#252526]"
      : "gap-2.5 rounded-xl px-3 py-2 text-xs font-medium hover:bg-white/55 dark:hover:bg-[#252526]",
    className
  );

  if (companyId) {
    return (
      <Link
        href="/workspaces"
        className={commonClasses}
        title="Đăng xuất"
      >
        <LogOut className="h-4.5 w-4.5 shrink-0" />
        {!isCollapsed && <span className="whitespace-nowrap font-medium">Đăng xuất</span>}
      </Link>
    );
  }

  const handleSignOut = signOutAction.bind(null, undefined);
  return (
    <form action={handleSignOut} className={cn(isCollapsed && "flex justify-center")}>
      <button
        type="submit"
        className={commonClasses}
        title="Đăng xuất"
      >
        <LogOut className="h-4.5 w-4.5 shrink-0" />
        {!isCollapsed && <span className="whitespace-nowrap font-medium">Đăng xuất</span>}
      </button>
    </form>
  );
}
