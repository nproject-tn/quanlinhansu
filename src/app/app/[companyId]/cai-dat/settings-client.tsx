"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotifications } from "@/components/notifications/notification-center";
import { InviteUserModal } from "@/components/employees/invite-user-modal";
import { MemberPermissionsSheet } from "./member-permissions-sheet";
import { RolesManagement } from "./roles-management";
import { CompanySettings } from "./company-settings";
import { ROLE_LABELS } from "@/lib/utils";

type UserMember = {
  id: string;
  userId: string;
  companyId: string;
  role: string;
  permissions: any;
  companyRoleId?: string | null;
  companyRole?: {
    id: string;
    name: string;
  } | null;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
};

type CompanyRole = {
  id: string;
  name: string;
  permissions: any;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

type SettingsData = {
  members: UserMember[];
  invitations: Invitation[];
  roles: CompanyRole[];
};

export function SettingsClient({ companyId, userRole, canEdit }: { companyId: string, userRole: string, canEdit: boolean }) {
  const { notify } = useNotifications();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserMember | null>(null);

  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load");
    return res.json();
  };

  const { data, mutate } = useSWR<SettingsData>(`/api/settings/members`, fetcher);

  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];
  const roles = data?.roles ?? [];

  const handleSaveMember = async (memberId: string, updates: { role: string, permissions: any }) => {
    try {
      const res = await fetch(`/api/settings/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          ...updates
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Update failed");
      }

      notify({ tone: "success", title: "Thành công", body: "Đã lưu thay đổi" });
      mutate();
    } catch (err) {
      notify({ tone: "error", title: "Lỗi", body: "Lỗi khi lưu thay đổi" });
      throw err;
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/settings/members?memberId=${memberId}`, {
        method: "DELETE",
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Delete failed");

      notify({ tone: "success", title: "Thành công", body: "Đã xoá thành viên khỏi doanh nghiệp" });
      mutate();
    } catch (err: any) {
      notify({ tone: "error", title: "Lỗi", body: err.message || "Lỗi khi xoá thành viên" });
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* Thông tin doanh nghiệp */}
      <CompanySettings companyId={companyId} canEdit={canEdit} />

      <Card className="border-none shadow-sm overflow-hidden bg-white/80 glass-control">
        <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-row items-center justify-between">
          <CardTitle>Danh sách thành viên ({members.length})</CardTitle>
          {canEdit && (
            <Button onClick={() => setShowInviteModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold">
              <Plus className="mr-1.5 h-4 w-4" /> Mời thành viên
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500 bg-slate-50/30">
                  <th className="px-6 py-4 font-medium">Thành viên</th>
                  <th className="px-6 py-4 font-medium">Chức vụ chính</th>
                  {canEdit && <th className="px-6 py-4 font-medium text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr 
                    key={member.id} 
                    className="border-b last:border-0 hover:bg-slate-50/80 cursor-pointer transition-colors"
                    onClick={() => setSelectedMember(member)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold shadow-sm">
                          {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{member.user.name || "Chưa cập nhật"}</div>
                          <div className="text-slate-500 text-xs">{member.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 border">
                        {member.companyRole ? member.companyRole.name : (ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role)}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(member);
                          }}
                          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        >
                          <Settings2 className="h-4 w-4 mr-2" /> Phân quyền
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card className="border-none shadow-sm overflow-hidden bg-white/80 glass-control">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle>Lời mời đang chờ ({invitations.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500 bg-slate-50/30">
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Chức vụ mời</th>
                    <th className="px-6 py-4 font-medium text-right">Ngày hết hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-medium text-slate-900">{inv.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 border">
                          {ROLE_LABELS[inv.role as keyof typeof ROLE_LABELS] || inv.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-right">
                        {new Date(inv.expiresAt).toLocaleDateString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <RolesManagement companyId={companyId} roles={roles} mutate={mutate} canEdit={canEdit} />

      {showInviteModal && (
        <InviteUserModal
          companyId={companyId}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => mutate()}
        />
      )}

      <MemberPermissionsSheet
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
        membersCount={members.length}
        roles={data?.roles || []}
        onSave={handleSaveMember}
        onDelete={handleDeleteMember}
        canEdit={canEdit}
      />
    </div>
  );
}
