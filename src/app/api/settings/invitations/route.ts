import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const authCheck = await requireAuth(["OWNER"], { module: "settings", action: "EDIT" });
  if (authCheck.error) return authCheck.error;

  const { companyId } = authCheck;

  try {
    const url = new URL(request.url);
    const invitationId = url.searchParams.get("id");

    if (!invitationId) {
      return NextResponse.json({ error: "Thiếu ID lời mời" }, { status: 400 });
    }

    const invitation = await prisma.companyInvitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation || invitation.companyId !== companyId) {
      return NextResponse.json({ error: "Không tìm thấy lời mời hoặc lời mời không thuộc doanh nghiệp này" }, { status: 404 });
    }

    await prisma.companyInvitation.delete({
      where: { id: invitationId }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Đã huỷ lời mời gửi tới ${invitation.email} thành công` 
    });
  } catch (err: any) {
    console.error("DELETE /api/settings/invitations error:", err);
    return NextResponse.json({ error: "Lỗi khi huỷ lời mời: " + err.message }, { status: 500 });
  }
}
