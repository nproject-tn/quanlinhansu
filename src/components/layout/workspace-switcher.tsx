"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { RefreshCw, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Membership = {
  companyId: string;
  role: string;
  company: {
    id: string;
    name: string;
    logo: string | null;
  };
};

export function WorkspaceSwitcher({
  currentCompanyId,
  isCollapsed,
}: {
  currentCompanyId: string;
  isCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load");
    return res.json();
  };

  const { data: memberships, isLoading } = useSWR<Membership[]>(
    "/api/users/me/workspaces",
    fetcher
  );

  const currentCompany = memberships?.find(m => m.companyId === currentCompanyId)?.company;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-9 w-9 shrink-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-all duration-300 flex items-center justify-center dark:text-[#9D9D9D] dark:hover:text-white dark:hover:bg-[#252526]",
            open && "bg-slate-200/50 text-slate-900 dark:bg-[#2D2D30] dark:text-white"
          )}
          title="Chuyển đổi doanh nghiệp"
        >
          <div className="relative w-[26px] h-[26px] flex items-center justify-center">
            <RefreshCw 
              className={cn(
                "absolute inset-0 w-full h-full text-slate-400 dark:text-[#9D9D9D] transition-transform duration-500", 
                open ? "rotate-180 text-indigo-600 dark:text-indigo-400" : "group-hover:text-slate-600 dark:group-hover:text-white"
              )}
              strokeWidth={1.75}
            />
            <div className="relative z-10 h-[15px] w-[15px] rounded-full bg-white border border-slate-300 flex items-center justify-center overflow-hidden shadow-2xs dark:bg-[#252526] dark:border-[#3C3C3C]">
              {currentCompany?.logo ? (
                <img src={currentCompany.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] font-bold text-slate-700 uppercase dark:text-white leading-none">
                  {currentCompany?.name ? currentCompany.name.charAt(0) : "W"}
                </span>
              )}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-2 rounded-2xl shadow-xl border border-slate-200/60 ml-4 mb-2 dark:border-[#333333] dark:bg-[#252526] dark:text-[#E0E0E0] backdrop-blur-xl z-50"
        side={isCollapsed ? "right" : "top"}
        align="end"
      >
        <div className="mb-2 px-2 pt-1">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-[#9D9D9D]">
            Không gian làm việc
          </h4>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : !memberships || memberships.length === 0 ? (
          <div className="p-3 text-sm text-slate-500 text-center dark:text-[#9D9D9D]">
            Không có doanh nghiệp nào
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {memberships.map((m) => {
              const isCurrent = m.companyId === currentCompanyId;
              return (
                <Link
                  key={m.companyId}
                  href={`/app/${m.companyId}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer text-sm",
                    isCurrent 
                      ? "bg-slate-100 font-medium text-slate-900 dark:bg-[#37373D] dark:text-white" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-[#CCCCCC] dark:hover:bg-[#2D2D30] dark:hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 dark:bg-[#1E1E1E] dark:border-[#3C3C3C]">
                      {m.company.logo ? (
                        <img src={m.company.logo} alt={m.company.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-slate-700 uppercase dark:text-[#E0E0E0]">
                          {m.company.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <span className="truncate">{m.company.name}</span>
                  </div>
                  {isCurrent && (
                    <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
                  )}
                </Link>
              );
            })}
          </div>
        )}
        
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#333333]">
          <Link
            href="/workspaces"
            onClick={() => setOpen(false)}
            className="flex items-center p-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors dark:text-[#9D9D9D] dark:hover:bg-[#2D2D30] dark:hover:text-white"
          >
            Quản lý tất cả doanh nghiệp
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
