import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CalendarDays, Users, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();
  const today = format(new Date(), "yyyy-MM-dd");
  const isEmployee = session?.user.role === "EMPLOYEE";

  const [employeeCount, storeCount, unfilledCount] = isEmployee
    ? [0, 0, 0]
    : await prisma.$transaction([
        prisma.employee.count({ where: { isActive: true } }),
        prisma.store.count({ where: { isActive: true } }),
        prisma.shiftAssignment.count({
          where: {
            date: { gte: new Date(today) },
            employeeId: null,
          },
        }),
      ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
        <p className="text-slate-600">
          Xin chào, {session?.user.name}! Hệ thống quản lý nhân sự & xếp ca Apexflow.
        </p>
      </div>

      {!isEmployee && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Nhân viên</CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{employeeCount}</p>
              <p className="text-sm text-slate-500">đang hoạt động</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Cửa hàng</CardTitle>
              <Building2 className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{storeCount}</p>
              <p className="text-sm text-slate-500">đang hoạt động</p>
            </CardContent>
          </Card>

          <Card className={unfilledCount > 0 ? "border-amber-200" : ""}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Ca trống</CardTitle>
              <AlertTriangle className={`h-5 w-5 ${unfilledCount > 0 ? "text-amber-600" : "text-emerald-600"}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{unfilledCount}</p>
              <p className="text-sm text-slate-500">từ hôm nay trở đi</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Lịch làm việc
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600">
            {isEmployee
              ? "Xem lịch ca được phân công cho bạn."
              : "Xếp ca tự động theo giờ tối đa, đa dạng ca và cửa hàng. Có thể chỉnh thủ công bằng kéo thả."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge>Phase 1</Badge>
            <Badge variant="success">Xếp ca tự động</Badge>
            <Badge>Multi-store</Badge>
            <Badge>Chống trùng ca</Badge>
          </div>
          <Link href="/lich-xep-ca">
            <Button>Xem lịch xếp ca</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
