import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth-actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        <LogOut className="h-4 w-4" />
        Đăng xuất
      </button>
    </form>
  );
}
