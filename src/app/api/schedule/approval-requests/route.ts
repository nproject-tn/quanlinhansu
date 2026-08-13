import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, permissions, error, companyId } = await requireAuth(["OWNER"], { module: "schedule", action: "EDIT" });
  if (error) return error;

  const isAdmin = session!.user.role === "ADMIN" || session!.user.role === "OWNER";
  const hasApprovePerm = typeof permissions === "object" && !!permissions?.schedule?.approve;
  const isApprover = isAdmin || hasApprovePerm;

  const requests = await prisma.scheduleApprovalRequest.findMany({
    where: {
      companyId,
      status: "PENDING",
      ...(!isApprover ? { requestedById: session!.user.id } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 30,
    include: {
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return NextResponse.json(
    requests.map((request) => ({
      id: request.id,
      actionType: request.actionType,
      status: request.status,
      message: request.message,
      payload: request.payload,
      conflicts: request.conflicts,
      createdAt: request.createdAt,
      requestedBy: request.requestedBy,
    }))
  );
}
