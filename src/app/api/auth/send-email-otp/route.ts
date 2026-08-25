import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp địa chỉ email hợp lệ" },
        { status: 400 }
      );
    }

    // 1. Generate 6-digit numeric OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // 2. Clean up any existing tokens for this email
    try {
      await prisma.verificationToken.deleteMany({
        where: { identifier: cleanEmail },
      });
    } catch {
      // ignore
    }

    // 3. Store new OTP in database
    await prisma.verificationToken.create({
      data: {
        identifier: cleanEmail,
        token: otp,
        expires,
      },
    });

    // 4. Send Email
    const emailRes = await sendOtpEmail(cleanEmail, otp);
    if (!emailRes.success) {
      return NextResponse.json(
        { error: emailRes.error || "Không thể gửi email xác thực" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Mã OTP đã được gửi đến email ${cleanEmail}`,
    });
  } catch (error: any) {
    console.error("[Send Email OTP Error]:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi xử lý gửi mã OTP" },
      { status: 500 }
    );
  }
}
