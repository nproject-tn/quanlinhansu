import { auth } from "@/lib/auth";
import { SettingsClient } from "./settings-client";
import { verifyCompanyAccess } from "@/lib/dal";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

export default async function SettingsPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const access = await verifyCompanyAccess(companyId);

  const permissions = access.permissions as any;
  const hasSettingsAccess = access.role === "OWNER" || hasPermission(access.role, permissions, "settings", "EDIT") || hasPermission(access.role, permissions, "settings", "VIEW");
  const hasPendingTransfer = !!access.pendingTransfer;

  if (!hasSettingsAccess && !hasPendingTransfer) {
    redirect(`/app/${companyId}`);
  }

  return (
    <SettingsClient 
      userRole={access.role} 
      companyId={companyId} 
      currentUserId={access.userId}
      canEdit={access.role === "OWNER" || hasPermission(access.role, permissions, "settings", "EDIT")} 
      pendingTransfer={access.pendingTransfer}
      hasSettingsAccess={hasSettingsAccess}
    />
  );
}
