import { auth } from "@/lib/auth";
import { SchedulePageClient } from "@/components/schedule/schedule-page-client";

export default async function SchedulePage() {
  const session = await auth();

  return (
    <SchedulePageClient
      user={{
        name: session?.user.name ?? "",
        role: session?.user.role ?? "EMPLOYEE",
      }}
    />
  );
}
