"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { inviteUserToCompany } from "@/app/actions/invite-user";
import { useNotifications } from "@/components/notifications/notification-center";

export function InviteUserModal({ companyId, isOpen, onClose, onSuccess }: { companyId: string, isOpen: boolean, onClose: () => void, onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SCHEDULER" | "EMPLOYEE">("EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const { notify } = useNotifications();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const result = await inviteUserToCompany(companyId, email, role);
    setLoading(false);

    if (result.error) {
      notify({ title: "Lỗi", body: result.error, tone: "error" });
    } else {
      notify({ title: "Thành công", body: "Đã gửi lời mời", tone: "success" });
      onSuccess?.();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">Mời người dùng vào doanh nghiệp</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-2">Người dùng mới sẽ được mời với vai trò mặc định (Chưa có quyền). Bạn có thể phân quyền chi tiết cho họ sau khi họ tham gia.</p>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Đang gửi..." : "Gửi lời mời"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
