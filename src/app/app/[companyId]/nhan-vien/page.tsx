import { verifyCompanyAccess } from "@/lib/dal";
import { EmployeePageClient } from "./employee-page-client";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

export default async function EmployeesPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const access = await verifyCompanyAccess(companyId);
  const permissions = access.permissions as any;

  if (
    !hasPermission(access.role, permissions, "employees", "VIEW") &&
    !hasPermission(access.role, permissions, "employees", "VIEW_LIST") &&
    !hasPermission(access.role, permissions, "employees", "EDIT")
  ) {
    redirect(`/app/${companyId}`);
  }

  return <EmployeePageClient userRole={access.role} userPermissions={access.permissions} companyId={companyId} />;
}

