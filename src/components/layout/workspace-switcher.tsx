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
            "p-1 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-all duration-300 flex items-center justify-center",
            open && "bg-slate-200/50 text-slate-900",
            isCollapsed && "w-full"
          )}
          title="Chuyển đổi doanh nghiệp"
        >
          <div className="relative w-9 h-9 flex items-center justify-center">
            <RefreshCw 
              className={cn(
                "absolute inset-0 w-full h-full transition-transform duration-500", 
                open ? "rotate-180 text-indigo-600" : "text-slate-400"
              )}
              strokeWidth={1.5}
            />
            <div className="relative z-10 h-5 w-5 rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
              {currentCompany?.logo ? (
                <img src={currentCompany.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[9px] font-bold text-slate-600 uppercase">
                  {currentCompany?.name ? currentCompany.name.charAt(0) : "W"}
                </span>
              )}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-2 rounded-2xl shadow-xl border-slate-200/60 ml-4 mb-2"
        side="right"
        align="end"
      >
        <div className="mb-2 px-2 pt-1">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Không gian làm việc
          </h4>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : !memberships || memberships.length === 0 ? (
          <div className="p-3 text-sm text-slate-500 text-center">
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
                    "flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer",
                    isCurrent ? "bg-indigo-50" : "hover:bg-slate-100"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.company.logo ? (
                        <img src={m.company.logo} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-slate-600 uppercase">
                          {m.company.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-sm font-medium truncate",
                      isCurrent ? "text-indigo-700" : "text-slate-700"
                    )}>
                      {m.company.name}
                    </span>
                  </div>
                  {isCurrent && <Check className="h-4 w-4 text-indigo-600 shrink-0 ml-2" />}
                </Link>
              );
            })}
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-slate-100">
          <Link
            href="/workspaces"
            onClick={() => setOpen(false)}
            className="flex items-center p-2 rounded-xl text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            Quản lý tất cả doanh nghiệp
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
