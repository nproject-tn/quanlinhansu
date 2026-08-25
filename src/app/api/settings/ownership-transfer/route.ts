import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

// GET /api/settings/ownership-transfer
export async function GET() {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  const { companyId, user } = authCheck;

  try {
    // Check if there is an active pending transfer for this company
    const pendingTransfer = await prisma.ownershipTransfer.findFirst({
      where: {
        companyId: companyId,
        status: "PENDING",
      },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ pendingTransfer });
  } catch (error: any) {
    console.error("GET /api/settings/ownership-transfer error:", error);
    return NextResponse.json({ error: "Lỗi khi lấy thông tin chuyển giao quyền sở hữu" }, { status: 500 });
  }
}

// POST /api/settings/ownership-transfer (Only current OWNER can initiate)
export async function POST(req: Request) {
  const authCheck = await requireAuth(["OWNER"]);
  if (authCheck.error) return authCheck.error;

  const { companyId, user } = authCheck;

  try {
    const body = await req.json();
    const { toUserId, toMemberId } = body;

    let targetUserId = toUserId;
    if (!targetUserId && toMemberId) {
      const member = await prisma.companyMember.findUnique({
        where: { id: toMemberId },
        select: { userId: true, companyId: true, role: true },
      });
      if (!member || member.companyId !== companyId) {
        return NextResponse.json({ error: "Thành viên không thuộc doanh nghiệp này" }, { status: 400 });
      }
      if (member.role === "OWNER") {
        return NextResponse.json({ error: "Thành viên này đã là Chủ sở hữu" }, { status: 400 });
      }
      targetUserId = member.userId;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "Thiếu thông tin người nhận quyền sở hữu" }, { status: 400 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Bạn đã là Chủ sở hữu của doanh nghiệp này" }, { status: 400 });
    }

    // Verify target user is a member of this company
    const targetMember = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId: targetUserId,
          companyId: companyId,
        }
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Người dùng không phải thành viên của doanh nghiệp" }, { status: 404 });
    }

    // Check if there is already an active pending transfer for this company
    const existingPending = await prisma.ownershipTransfer.findFirst({
      where: {
        companyId: companyId,
        status: "PENDING",
      },
      include: {
        toUser: { select: { name: true, email: true } },
      }
    });

    if (existingPending) {
      return NextResponse.json({ 
        error: `Đang có một lời mời chuyển giao quyền Chủ sở hữu chờ xác nhận gửi tới ${existingPending.toUser.name || existingPending.toUser.email} (${existingPending.toUser.email}). Bạn vui lòng huỷ lời mời hiện tại trước khi tạo lời mời mới.` 
      }, { status: 400 });
    }

    // Create new transfer request
    const transfer = await prisma.ownershipTransfer.create({
      data: {
        companyId: companyId,
        fromUserId: user.id,
        toUserId: targetUserId,
        status: "PENDING",
      },
      include: {
        toUser: { select: { name: true, email: true } },
      }
    });

    return NextResponse.json({
      success: true,
      message: `Đã gửi lời mời chuyển giao quyền Chủ sở hữu đến ${targetMember.user.email}`,
      transfer,
    });
  } catch (error: any) {
    console.error("POST /api/settings/ownership-transfer error:", error);
    return NextResponse.json({ error: "Lỗi khi tạo yêu cầu chuyển giao quyền sở hữu" }, { status: 500 });
  }
}

// DELETE /api/settings/ownership-transfer (Cancel pending transfer)
export async function DELETE() {
  const authCheck = await requireAuth(["OWNER"]);
  if (authCheck.error) return authCheck.error;

  const { companyId } = authCheck;

  try {
    await prisma.ownershipTransfer.updateMany({
      where: {
        companyId: companyId,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
      },
    });

    return NextResponse.json({ success: true, message: "Đã huỷ yêu cầu chuyển giao quyền Chủ sở hữu" });
  } catch (error: any) {
    console.error("DELETE /api/settings/ownership-transfer error:", error);
    return NextResponse.json({ error: "Lỗi khi huỷ yêu cầu chuyển giao" }, { status: 500 });
  }
}
