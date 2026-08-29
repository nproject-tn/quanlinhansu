import { redirect } from "next/navigation";

export default async function RevenueRedirectPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  redirect(`/app/${params.companyId}/don-hang`);
}
