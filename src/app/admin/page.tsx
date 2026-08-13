import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CreditCard } from "lucide-react";
import { AdminCompanyList } from "./admin-company-list";

export default async function AdminDashboardPage() {
  const [userCount, companyCount, subscriptionCount, companies] = await prisma.$transaction([
    prisma.user.count(),
    prisma.company.count(),
    prisma.subscription.count(),
    prisma.company.findMany({
      include: {
        _count: {
          select: { members: true, stores: true, employees: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tổng quan hệ thống</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng số Người dùng</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng số Doanh nghiệp</CardTitle>
            <Building2 className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptionCount}</div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold mt-8">Danh sách Doanh nghiệp</h2>
      <AdminCompanyList companies={companies as any} />
    </div>
  );
}
