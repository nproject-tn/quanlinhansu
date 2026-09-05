import { redirect } from "next/navigation";
import { verifyCompanyAccess } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";
import ShiftConfigClient from "./shift-config-client";

export default async function ShiftConfigPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const access = await verifyCompanyAccess(companyId);
  const permissions = access.permissions as any;

  if (!hasPermission(access.role, permissions, "shift_config", "EDIT") && !hasPermission(access.role, permissions, "shift_config", "VIEW")) {
    redirect(`/app/${companyId}`);
  }

  const canEdit = hasPermission(access.role, permissions, "shift_config", "EDIT");

  return <ShiftConfigClient canEdit={canEdit} companyId={companyId} />;
}
