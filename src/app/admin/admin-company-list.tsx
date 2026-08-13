"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/components/notifications/notification-center";
import { RefreshCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminCompanyList({ companies }: { companies: any[] }) {
  const { notify } = useNotifications();
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (companyId: string, action: "RESTORE" | "DELETE") => {
    if (action === "DELETE") {
      if (!confirm("Bạn có chắc chắn muốn xóa VĨNH VIỄN doanh nghiệp này? Mọi dữ liệu sẽ mất hoàn toàn.")) return;
    }
    
    setLoadingId(companyId);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: action === "RESTORE" ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      
      if (!res.ok) throw new Error("Thao tác thất bại");
      
      notify({ tone: "success", title: "Thành công", body: action === "RESTORE" ? "Đã khôi phục doanh nghiệp" : "Đã xóa vĩnh viễn doanh nghiệp" });
      router.refresh();
    } catch (error: any) {
      notify({ tone: "error", title: "Lỗi", body: error.message });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-700 uppercase border-b">
          <tr>
            <th className="px-6 py-3">Tên doanh nghiệp</th>
            <th className="px-6 py-3">ID</th>
            <th className="px-6 py-3">Số lượng</th>
            <th className="px-6 py-3">Trạng thái</th>
            <th className="px-6 py-3">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-b hover:bg-slate-50">
              <td className="px-6 py-4 font-medium">{company.name}</td>
              <td className="px-6 py-4 font-mono text-xs">{company.id}</td>
              <td className="px-6 py-4 text-xs">
                {company._count.members} thành viên<br/>
                {company._count.stores} cửa hàng
              </td>
              <td className="px-6 py-4">
                {company.isActive ? (
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">Hoạt động</span>
                ) : (
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">Đã giải tán</span>
                )}
              </td>
              <td className="px-6 py-4">
                {!company.isActive && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-8 text-indigo-600 hover:text-indigo-700"
                      onClick={() => handleAction(company.id, "RESTORE")}
                      disabled={loadingId === company.id}
                    >
                      <RefreshCcw className="h-4 w-4 mr-1" /> Khôi phục
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      className="h-8"
                      onClick={() => handleAction(company.id, "DELETE")}
                      disabled={loadingId === company.id}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Xóa vĩnh viễn
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {companies.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                Chưa có doanh nghiệp nào trên hệ thống.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
