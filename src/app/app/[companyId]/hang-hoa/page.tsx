import { ProductsClient } from "./products-client";
import { verifyCompanyAccess } from "@/lib/dal";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

export default async function ProductsPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const access = await verifyCompanyAccess(companyId);
  const permissions = access.permissions as any;

  if (
    !hasPermission(access.role, permissions, "products", "EDIT") &&
    !hasPermission(access.role, permissions, "products", "VIEW")
  ) {
    redirect(`/app/${companyId}`);
  }

  return (
    <ProductsClient
      userRole={access.role}
      companyId={companyId}
      canEdit={hasPermission(access.role, permissions, "products", "EDIT")}
    />
  );
}
