import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { LoginShowcase } from "./login-showcase";

export default async function LoginPage() {
  const session = await auth();

  return (
    <main className="h-screen w-screen bg-slate-50 dark:bg-[#121214] flex overflow-hidden font-sans select-none p-1.5 sm:p-2 lg:p-2">
      {/* LEFT HALF: DARK LUXURY HERO & SHOWCASE (50% ON DESKTOP) */}
      <div className="hidden lg:block lg:w-1/2 h-full rounded-lg lg:rounded-xl overflow-hidden bg-black shadow-md border border-black dark:border-neutral-800">
        <LoginShowcase />
      </div>

      {/* RIGHT HALF: CLEAN MINIMALIST AUTH (50% ON DESKTOP) */}
      <div className="w-full lg:w-1/2 h-full bg-white dark:bg-[#18181B] border border-slate-200/60 dark:border-neutral-800 rounded-lg lg:rounded-xl flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-y-auto no-scrollbar transition-colors">
        {/* Top right home link */}
        <div className="w-full flex justify-end">
          <a
            href="/home-apexflow"
            className="text-xs font-semibold text-slate-400 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            Về trang chủ
          </a>
        </div>

        {/* Centered Login Box */}
        <div className="w-full max-w-[360px] mx-auto my-auto py-2">
          <Suspense fallback={<div className="text-center py-6 text-sm text-slate-400 dark:text-neutral-400">Đang tải...</div>}>
            <LoginForm currentSessionUser={session?.user ?? null} />
          </Suspense>
        </div>

        {/* Bottom copyright */}
        <div className="w-full text-center text-[11px] text-slate-400 dark:text-neutral-500 pt-2">
          © {new Date().getFullYear()} ApexFlow Cloud Enterprise.
        </div>
      </div>
    </main>
  );
}
