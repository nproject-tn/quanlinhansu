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
      <main className="flex flex-1 flex-col pb-8">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <ApprovalRequestWatcher enabled={session.user.role === "ADMIN"} />
          <div className="flex-1">{children}</div>
        </div>
      </main>
      <footer className="absolute bottom-4 left-0 w-full pointer-events-none text-center text-sm text-slate-500">
        © 2026 Tokyolife by ApexFlow
      </footer>
    </div>
  );
}
