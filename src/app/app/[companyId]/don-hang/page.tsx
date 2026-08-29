import { OrdersClient } from "./orders-client";
import { verifyCompanyAccess } from "@/lib/dal";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

export default async function OrdersPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const access = await verifyCompanyAccess(companyId);
  const permissions = access.permissions as any;

  if (
    !hasPermission(access.role, permissions, "revenue", "EDIT") &&
    !hasPermission(access.role, permissions, "revenue", "VIEW")
  ) {
    redirect(`/app/${companyId}`);
  }

  const canEdit = hasPermission(access.role, permissions, "revenue", "EDIT");
  const canDelete = hasPermission(access.role, permissions, "revenue", "DELETE");

  return (
    <OrdersClient
      companyId={companyId}
      userRole={access.role}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
