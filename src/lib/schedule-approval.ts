import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ScheduleConflict } from "@/lib/schedule-engine";

type ApprovalAction = "ASSIGN_EMPLOYEE" | "MOVE_ASSIGNMENT" | "DELETE_FAULT" | "ADD_OVERTIME" | "UPDATE_OVERTIME" | "DELETE_OVERTIME";

type CreateApprovalRequestInput = {
  actionType: ApprovalAction;
  requestedById?: string;
  payload: Prisma.InputJsonValue;
  conflicts: ScheduleConflict[];
  message: string;
  companyId: string;
};

function isDeepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
    return false;
  }
  const keys1 = Object.keys(obj1).filter(k => obj1[k] !== undefined);
  const keys2 = Object.keys(obj2).filter(k => obj2[k] !== undefined);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!keys2.includes(key) || !isDeepEqual(obj1[key], obj2[key])) return false;
  }
  return true;
}

export async function createScheduleApprovalRequest({
  actionType,
  requestedById,
  payload,
  conflicts,
  message,
  companyId,
}: CreateApprovalRequestInput) {
  // Check for duplicates
  const existingPending = await prisma.scheduleApprovalRequest.findMany({
    where: {
      companyId,
      actionType,
      requestedById,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const duplicate = existingPending.find(
    (req) => isDeepEqual(req.payload, payload)
  );

  if (duplicate) {
    return { ...duplicate, isDuplicate: true };
  }

  return prisma.scheduleApprovalRequest.create({
    data: {
      companyId,
      actionType,
      requestedById,
      payload,
      conflicts: conflicts as unknown as Prisma.InputJsonValue,
      message,
    },
  });
}
