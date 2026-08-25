import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Plus, ArrowRight, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { WorkspaceListClient } from "./workspace-list-client";

export default async function WorkspacesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }

  // Resolve actual user from database by email or session ID
  const dbUser = session.user.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true, companyId: true, role: true },
      })
    : await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, companyId: true, role: true },
      });

  const userId = dbUser?.id ?? session.user.id;
  const userEmail = dbUser?.email ?? session.user.email;

  // Auto-accept any pending invitations for this email
  if (userEmail) {
    const pendingInvites = await prisma.companyInvitation.findMany({
      where: { email: userEmail, status: "PENDING" },
    });

    for (const invite of pendingInvites) {
      // Create membership
      await prisma.companyMember.upsert({
        where: {
          userId_companyId: {
            userId: userId,
            companyId: invite.companyId,
          },
        },
        create: {
          userId: userId,
          companyId: invite.companyId,
          role: invite.role,
          companyRoleId: invite.companyRoleId,
        },
        update: {
          role: invite.role,
          companyRoleId: invite.companyRoleId,
        },
      });

      // Update invite status
      await prisma.companyInvitation.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED" },
      });
    }
  }

  // Lấy danh sách doanh nghiệp user tham gia
  const memberships = await prisma.companyMember.findMany({
    where: { 
      userId: userId,
      company: { isActive: true }
    },
    include: {
      company: {
        include: {
          _count: {
            select: { members: true, stores: true }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  const ownedCompanies = memberships.filter((m) => m.role === "OWNER");
  const assignedCompanies = memberships.filter((m) => m.role !== "OWNER");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] relative overflow-hidden">
      <div className="absolute top-0 -left-64 h-[500px] w-[500px] rounded-full bg-slate-300/20 dark:bg-slate-700/10 blur-[120px] mix-blend-multiply pointer-events-none"></div>
      <div className="absolute bottom-0 -right-64 h-[500px] w-[500px] rounded-full bg-slate-200/20 dark:bg-slate-800/10 blur-[120px] mix-blend-multiply pointer-events-none"></div>
      
      <header className="bg-white/80 dark:bg-[#181818]/80 backdrop-blur-md border-b border-slate-200 dark:border-neutral-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-shape.svg" alt="Apexflow HR" className="h-8 w-auto object-contain grayscale dark:invert" />
            <span className="font-bold text-slate-900 dark:text-white tracking-tight text-lg hidden sm:block">ApexFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-slate-700 dark:text-neutral-300 hidden sm:block">
              Xin chào, {session.user.name}
            </div>
            {session.user.isSuperAdmin && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="gap-2 dark:bg-[#242428] dark:border-neutral-700 dark:text-neutral-200">
                  <ShieldCheck className="h-4 w-4" />
                  Admin Panel
                </Button>
              </Link>
            )}
            <SignOutButton className="text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors" />
          </div>
        </div>
      </header>

      <WorkspaceListClient 
        ownedCompanies={ownedCompanies as any} 
        assignedCompanies={assignedCompanies as any} 
      />
    </div>
  );
}
