import { redirect } from "next/navigation";

export default async function PosRedirectPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  redirect(`/pos/${params.companyId}`);
}
