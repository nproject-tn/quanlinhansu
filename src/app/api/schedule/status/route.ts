import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const lastAssignment = await prisma.shiftAssignment.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const lastRequest = await prisma.scheduleApprovalRequest.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    return NextResponse.json({
      assignments: lastAssignment?.updatedAt ?? null,
      requests: lastRequest?.updatedAt ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
