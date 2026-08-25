import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { ApprovalRequestWatcher } from "@/components/notifications/approval-request-watcher";
import { verifyCompanyAccess } from "@/lib/dal";

export default async function DashboardLayout(props: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;
  const { children } = props;

  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }

  const access = await verifyCompanyAccess(companyId);

  // Override session user role with the one from the specific company
  const userWithCompanyRole = {
    ...session.user,
    role: access.role,
    permissions: access.permissions,
    pendingTransfer: access.pendingTransfer,
  };

  return (
    <div className="relative flex min-h-screen flex-col md:flex-row gap-4 bg-slate-50 dark:bg-[#1E1E1E] p-4 pt-20 md:pt-4 transition-colors duration-200">
      <Sidebar user={userWithCompanyRole} companyId={companyId} />
      <main className="flex flex-1 min-w-0 flex-col pb-8">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
          <ApprovalRequestWatcher enabled={userWithCompanyRole.role === "ADMIN" || userWithCompanyRole.role === "OWNER"} />
          <div className="flex-1">{children}</div>
        </div>
      </main>
      <footer className="absolute bottom-4 left-0 w-full pointer-events-none text-center text-sm text-slate-500 dark:text-[#858585]">
        &copy; 2026 ApexFlow Inc. Bảo lưu mọi quyền.
      </footer>
    </div>
  );
}
