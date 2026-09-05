import { auth } from "@/lib/auth";
import { SchedulePageClient } from "@/components/schedule/schedule-page-client";
import { verifyCompanyAccess } from "@/lib/dal";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

export default async function SchedulePage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const session = await auth();
  const access = await verifyCompanyAccess(companyId);

  const permissions = access.permissions as any;

  if (!hasPermission(access.role, permissions, "schedule", "VIEW")) {
    redirect(`/app/${companyId}`);
  }

  return (
    <SchedulePageClient
      companyId={companyId}
      user={{
        name: session?.user.name ?? "",
        role: access.role,
        permissions: access.permissions,
      }}
    />
  );
}
