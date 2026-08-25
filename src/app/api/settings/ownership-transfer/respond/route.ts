import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { Prisma } from "@/generated/prisma/client";

// POST /api/settings/ownership-transfer/respond
export async function POST(req: Request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  const { companyId, user } = authCheck;

  try {
    const body = await req.json();
    const { transferId, action } = body; // action: "ACCEPT" | "REJECT"

    if (!transferId || !["ACCEPT", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Tham số không hợp lệ" }, { status: 400 });
    }

    const transfer = await prisma.ownershipTransfer.findUnique({
      where: { id: transferId },
      include: {
        company: { select: { id: true, name: true } },
        fromUser: { select: { id: true, email: true } },
        toUser: { select: { id: true, email: true } },
      }
    });

    if (!transfer || transfer.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy yêu cầu chuyển giao" }, { status: 404 });
    }

    if (transfer.toUserId !== user.id) {
      return NextResponse.json({ error: "Bạn không phải người nhận yêu cầu này" }, { status: 403 });
    }

    if (transfer.status !== "PENDING") {
      return NextResponse.json({ error: `Yêu cầu này đã ở trạng thái ${transfer.status}` }, { status: 400 });
    }

    if (action === "REJECT") {
      await prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: { status: "REJECTED" },
      });
      return NextResponse.json({ success: true, message: "Đã từ chối tiếp nhận quyền Chủ sở hữu" });
    }

    // ACCEPT: Run atomic transaction
    await prisma.$transaction(async (tx) => {
      // 1. Promote new owner to OWNER (Full permissions)
      await tx.companyMember.update({
        where: {
          userId_companyId: {
            userId: transfer.toUserId,
            companyId: companyId,
          }
        },
        data: {
          role: "OWNER",
          companyRoleId: null,
          permissions: Prisma.JsonNull,
        }
      });

      // 2. Remove old owner from CompanyMember (automatically leaves the company)
      await tx.companyMember.delete({
        where: {
          userId_companyId: {
            userId: transfer.fromUserId,
            companyId: companyId,
          }
        }
      });

      // 3. Clear legacy user.companyId for old owner if matching
      await tx.user.updateMany({
        where: {
          id: transfer.fromUserId,
          companyId: companyId,
        },
        data: {
          companyId: null,
        }
      });

      // 4. Mark transfer as ACCEPTED
      await tx.ownershipTransfer.update({
        where: { id: transferId },
        data: { status: "ACCEPTED" },
      });

      // 5. Cancel any other pending transfers for this company
      await tx.ownershipTransfer.updateMany({
        where: {
          companyId: companyId,
          status: "PENDING",
          id: { not: transferId },
        },
        data: { status: "CANCELLED" },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Chúc mừng bạn đã trở thành Chủ sở hữu của ${transfer.company.name}!`,
    });
  } catch (error: any) {
    console.error("POST /api/settings/ownership-transfer/respond error:", error);
    return NextResponse.json({ error: "Lỗi khi xử lý tiếp nhận quyền Chủ sở hữu" }, { status: 500 });
  }
}
