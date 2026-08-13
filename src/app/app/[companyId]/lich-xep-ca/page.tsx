import { auth } from "@/lib/auth";
import { SchedulePageClient } from "@/components/schedule/schedule-page-client";
import { verifyCompanyAccess } from "@/lib/dal";

export default async function SchedulePage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;

  const session = await auth();
  const access = await verifyCompanyAccess(companyId);

  return (
    <SchedulePageClient
      user={{
        name: session?.user.name ?? "",
        role: access.role,
        permissions: access.permissions,
      }}
    />
  );
}
