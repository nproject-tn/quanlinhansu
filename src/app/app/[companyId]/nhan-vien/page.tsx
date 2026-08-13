import { verifyCompanyAccess } from "@/lib/dal";
import { EmployeePageClient } from "./employee-page-client";

export default async function EmployeesPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const access = await verifyCompanyAccess(companyId);

  return <EmployeePageClient userRole={access.role} userPermissions={access.permissions} companyId={companyId} />;
}
