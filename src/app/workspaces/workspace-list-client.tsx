"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus, CheckCircle2, Circle, Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications/notification-center";
import { uploadCompanyLogoAction, deleteCompanyLogoAction } from "./actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Company = {
  id: string;
  name: string;
  logo: string | null;
  _count?: {
    members: number;
    stores: number;
  };
};

type Membership = {
  companyId: string;
  role: string;
  createdAt: Date;
  company: Company;
};

export function WorkspaceListClient({
  ownedCompanies,
  assignedCompanies,
}: {
  ownedCompanies: Membership[];
  assignedCompanies: Membership[];
}) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDisbanding, setIsDisbanding] = useState(false);
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds([]);
  };

  const toggleSelection = (companyId: string) => {
    if (selectedIds.includes(companyId)) {
      setSelectedIds(selectedIds.filter((id) => id !== companyId));
    } else {
      setSelectedIds([...selectedIds, companyId]);
    }
  };

  const handleDisband = async () => {
    setIsDisbanding(true);
    try {
      const res = await fetch("/api/companies/disband", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: selectedIds }),
      });
      if (!res.ok) throw new Error("Lỗi giải tán");
      
      notify({ tone: "success", title: "Đã giải tán thành công", body: "Đã giải tán các công ty đã chọn." });
      setSelectedIds([]);
      setIsSelectMode(false);
      setShowConfirm(false);
      router.refresh();
    } catch (e: any) {
      notify({ tone: "error", title: "Lỗi", body: e.message });
    } finally {
      setIsDisbanding(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>, companyId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadingLogoId(companyId);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      await uploadCompanyLogoAction(companyId, formData);
      notify({ tone: "success", title: "Thành công", body: "Đã cập nhật logo doanh nghiệp" });
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setUploadingLogoId(null);
    }
  };

  const handleDeleteLogo = async (e: React.MouseEvent, companyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setUploadingLogoId(companyId);
    try {
      await deleteCompanyLogoAction(companyId);
      notify({ tone: "success", title: "Thành công", body: "Đã xoá logo doanh nghiệp" });
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message });
    } finally {
      setUploadingLogoId(null);
    }
  };

  const renderCompanyCard = (membership: Membership, isOwned: boolean) => {
    const isSelected = selectedIds.includes(membership.company.id);
    
    return (
      <div 
        key={membership.company.id}
        onClick={(e) => {
          if (isSelectMode && isOwned) {
            toggleSelection(membership.company.id);
          } else if (!isSelectMode) {
            // Check if click was on the upload input label or delete button to prevent navigation
            if ((e.target as HTMLElement).closest('.upload-label') || (e.target as HTMLElement).closest('.delete-logo-btn')) return;
            router.push(`/app/${membership.company.id}`);
          }
        }}
        className={cn(
          "group relative bg-white rounded-2xl p-6 shadow-sm border transition-all cursor-pointer",
          isSelectMode && isOwned ? (isSelected ? "border-red-500 ring-2 ring-red-500/20" : "border-slate-200 hover:border-slate-300") : "border-slate-200 hover:shadow-md hover:border-indigo-200"
        )}
      >
        {isSelectMode && isOwned && (
          <div className="absolute -top-3 -right-3 z-10 bg-white rounded-full">
            {isSelected ? (
              <CheckCircle2 className="h-7 w-7 text-red-500 fill-white" />
            ) : (
              <Circle className="h-7 w-7 text-slate-300" />
            )}
          </div>
        )}
        
        <div className="flex items-start justify-between mb-4">
          <div className="relative group/logo">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-slate-100 flex items-center justify-center overflow-hidden">
              {uploadingLogoId === membership.company.id ? (
                <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
              ) : membership.company.logo ? (
                <img src={membership.company.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className={cn("font-bold text-xl uppercase", isOwned ? "text-indigo-600" : "text-slate-600")}>
                  {membership.company.name.charAt(0)}
                </span>
              )}
            </div>
            {isOwned && !isSelectMode && (
              <>
                <label className="upload-label absolute inset-0 bg-black/50 text-white rounded-xl opacity-0 group-hover/logo:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Upload className="h-4 w-4" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleUploadLogo(e, membership.company.id)}
                    disabled={uploadingLogoId === membership.company.id}
                  />
                </label>
                {membership.company.logo && (
                  <button
                    type="button"
                    title="Xoá logo"
                    className="delete-logo-btn absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover/logo:opacity-100 transition-opacity hover:bg-red-500 hover:text-white shadow-sm border border-red-200 z-10"
                    onClick={(e) => handleDeleteLogo(e, membership.company.id)}
                    disabled={uploadingLogoId === membership.company.id}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </div>
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {membership.role === "OWNER" ? "Chủ sở hữu" : membership.role === "ADMIN" ? "Quản trị viên" : membership.role === "SCHEDULER" ? "Quản lý lịch" : "Nhân viên"}
          </span>
        </div>
        <h3 className={cn("text-lg font-semibold mb-1 transition-colors", isOwned && !isSelectMode ? "group-hover:text-indigo-600 text-slate-900" : "text-slate-900")}>
          {membership.company.name}
        </h3>
        <div className="flex items-center gap-4 text-sm text-slate-500 mt-4">
          {isOwned && membership.company._count ? (
            <>
              <span>{membership.company._count.stores} chi nhánh</span>
              <span>•</span>
              <span>{membership.company._count.members} thành viên</span>
            </>
          ) : (
            <span>Tham gia: {new Date(membership.createdAt).toLocaleDateString("vi-VN")}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-12 relative z-10">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">Không gian làm việc</h1>
          <p className="text-slate-500">Chọn doanh nghiệp để bắt đầu quản lý nhân sự và lịch làm việc</p>
        </div>

        <div className="space-y-12">
          {/* Doanh nghiệp của bạn */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-500" />
                Doanh nghiệp của bạn
              </h2>
              <div className="flex items-center gap-3">
                {ownedCompanies.length > 0 && (
                  <>
                    {isSelectMode ? (
                      <>
                        <Button variant="ghost" onClick={toggleSelectMode} className="text-slate-500">
                          Hủy
                        </Button>
                        <Button 
                          variant="destructive" 
                          disabled={selectedIds.length === 0}
                          onClick={() => setShowConfirm(true)}
                        >
                          Xác nhận giải tán ({selectedIds.length})
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" onClick={toggleSelectMode} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                        Giải tán
                      </Button>
                    )}
                  </>
                )}
                {!isSelectMode && (
                  <Link href="/workspaces/create">
                    <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-sm">
                      <Plus className="h-4 w-4" />
                      Tạo doanh nghiệp
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            
            {ownedCompanies.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Chưa có doanh nghiệp nào</h3>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto">Bạn có thể tạo doanh nghiệp mới để quản lý chuỗi cửa hàng và nhân viên của mình.</p>
                <Link href="/workspaces/create">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">Tạo doanh nghiệp đầu tiên</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ownedCompanies.map((m) => renderCompanyCard(m, true))}
              </div>
            )}
          </section>

          {/* Doanh nghiệp được phụ trách */}
          {assignedCompanies.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mb-6">
                <Building2 className="h-5 w-5 text-slate-400" />
                Doanh nghiệp được phụ trách
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignedCompanies.map((m) => renderCompanyCard(m, false))}
              </div>
            </section>
          )}
        </div>
      </main>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Bạn có chắc chắn muốn giải tán doanh nghiệp?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-700">
              Bạn đang chọn giải tán <strong>{selectedIds.length}</strong> doanh nghiệp. 
              <br/><br/>
              <span className="text-red-500 font-medium text-sm">Tất cả dữ liệu sẽ bị xoá vĩnh viễn và không thể khôi phục.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisbanding}>Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDisband(); }} 
              disabled={isDisbanding}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDisbanding ? "Đang xử lý..." : "Đồng ý giải tán"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
