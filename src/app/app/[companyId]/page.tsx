import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CalendarDays, Users, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { verifyCompanyAccess } from "@/lib/dal";
import { hasPermission } from "@/lib/permissions";

export default async function DashboardPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const params = await props.params;
  const companyId = params.companyId;
  const session = await auth();
  const access = await verifyCompanyAccess(companyId);
  const today = format(new Date(), "yyyy-MM-dd");
  const isEmployee = access.role === "EMPLOYEE";
  const canViewSchedule = hasPermission(access.role, access.permissions, "schedule", "VIEW");

  const [employeeCount, storeCount, unfilledCount] = isEmployee
    ? [0, 0, 0]
    : await prisma.$transaction([
        prisma.employee.count({ where: { isActive: true, companyId } }),
        prisma.store.count({ where: { isActive: true, companyId } }),
        prisma.shiftAssignment.count({
          where: {
            date: { gte: new Date(today) },
            employeeId: null,
            companyId,
          },
        }),
      ]);

  return (
    <div className="space-y-6">

      {!isEmployee && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Nhân viên</CardTitle>
              <Users className="h-5 w-5 text-slate-900 dark:text-white" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{employeeCount}</p>
              <p className="text-sm text-slate-500 dark:text-[#A0A0A0]">đang hoạt động</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Cửa hàng</CardTitle>
              <Building2 className="h-5 w-5 text-slate-900 dark:text-white" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{storeCount}</p>
              <p className="text-sm text-slate-500 dark:text-[#A0A0A0]">đang hoạt động</p>
            </CardContent>
          </Card>

          <Card className={unfilledCount > 0 ? "border-amber-200 dark:border-amber-500/40" : ""}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Ca trống</CardTitle>
              <AlertTriangle className={`h-5 w-5 ${unfilledCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{unfilledCount}</p>
              <p className="text-sm text-slate-500 dark:text-[#A0A0A0]">từ hôm nay trở đi</p>
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
          <p className="text-slate-600 dark:text-[#B0B0B0]">
            {isEmployee
              ? canViewSchedule
                ? "Xem lịch ca được phân công cho bạn."
                : "Bạn chưa được cấp quyền xem lịch làm việc. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ."
              : "Xếp ca tự động theo giờ tối đa, đa dạng ca và cửa hàng. Có thể chỉnh thủ công bằng kéo thả."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge>Phase 1</Badge>
            <Badge variant="success">Xếp ca tự động</Badge>
            <Badge>Multi-store</Badge>
            <Badge>Chống trùng ca</Badge>
          </div>
          {canViewSchedule && (
            <Link href={`/app/${companyId}/lich-xep-ca`}>
              <Button>Xem lịch xếp ca</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
