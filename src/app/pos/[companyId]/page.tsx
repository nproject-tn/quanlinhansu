import { verifyCompanyAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { PosFullscreenClient } from "./pos-fullscreen-client";

export default async function StandalonePosPage(props: {
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

  const company = await prisma.company.findUnique({
    where: { id: access.companyDbId },
    select: { name: true },
  });

  const canEdit = hasPermission(access.role, permissions, "revenue", "EDIT");

  return (
    <PosFullscreenClient
      companyId={companyId}
      companyName={company?.name || "ApexFlow"}
      userRole={access.role}
      canEdit={canEdit}
    />
  );
}
