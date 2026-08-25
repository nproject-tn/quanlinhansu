import { redirect } from "next/navigation";
import { verifyCompanyAccess } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";
import StoresClient from "./stores-client";

export default async function StoresPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const access = await verifyCompanyAccess(companyId);
  const permissions = access.permissions as any;

  if (
    !hasPermission(access.role, permissions, "store", "EDIT") &&
    !hasPermission(access.role, permissions, "store", "VIEW") &&
    !hasPermission(access.role, permissions, "store", "DELETE")
  ) {
    redirect(`/app/${companyId}`);
  }

  const canEdit = hasPermission(access.role, permissions, "store", "EDIT");
  const canDelete = hasPermission(access.role, permissions, "store", "DELETE");

  return <StoresClient canEdit={canEdit} canDelete={canDelete} />;
}
