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

  if (!hasPermission(access.role, permissions, "settings", "EDIT") && !hasPermission(access.role, permissions, "settings", "VIEW")) {
    redirect(`/app/${companyId}`);
  }

  return <SettingsClient userRole={access.role} companyId={companyId} canEdit={hasPermission(access.role, permissions, "settings", "EDIT")} />;
}
