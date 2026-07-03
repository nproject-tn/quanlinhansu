import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth-actions";
import { cn } from "@/lib/utils";

export function SignOutButton({ isCollapsed }: { isCollapsed?: boolean }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-white/55 hover:text-slate-900 transition-colors duration-300",
          isCollapsed && "justify-center px-2"
        )}
        title={isCollapsed ? "Đăng xuất" : undefined}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="whitespace-nowrap">Đăng xuất</span>}
      </button>
    </form>
  );
}
