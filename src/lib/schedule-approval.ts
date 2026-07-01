import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ScheduleConflict } from "@/lib/schedule-engine";

type ApprovalAction = "ASSIGN_EMPLOYEE" | "MOVE_ASSIGNMENT";

type CreateApprovalRequestInput = {
  actionType: ApprovalAction;
  requestedById?: string;
  payload: Prisma.InputJsonValue;
  conflicts: ScheduleConflict[];
  message: string;
};

export async function createScheduleApprovalRequest({
  actionType,
  requestedById,
  payload,
  conflicts,
  message,
}: CreateApprovalRequestInput) {
  // Check for duplicates
  const existingPending = await prisma.scheduleApprovalRequest.findMany({
    where: {
      actionType,
      requestedById,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const stringifiedPayload = JSON.stringify(payload);
  const duplicate = existingPending.find(
    (req) => JSON.stringify(req.payload) === stringifiedPayload
  );

  if (duplicate) {
    return duplicate;
  }

  return prisma.scheduleApprovalRequest.create({
    data: {
      actionType,
      requestedById,
      payload,
      conflicts: conflicts as unknown as Prisma.InputJsonValue,
      message,
    },
  });
}
