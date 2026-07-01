import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { ApprovalRequestWatcher } from "@/components/notifications/approval-request-watcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }

  return (
    <div className="relative flex min-h-screen gap-4 bg-slate-50 p-4">
      <Sidebar user={session.user} />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <ApprovalRequestWatcher enabled={session.user.role === "ADMIN"} />
          <div className="flex-1 pb-10">{children}</div>
        </div>
        <footer className="mt-auto w-full pb-4 pt-10 pr-[17rem] text-center text-sm text-slate-500">
          © 2026 Tokyolife by ApexFlow
        </footer>
      </main>
    </div>
  );
}
