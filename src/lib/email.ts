import { Resend } from "resend";
import nodemailer from "nodemailer";

// Lazy initialize Resend or Nodemailer
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || "587");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASSWORD;
const emailFrom = process.env.EMAIL_FROM || "ApexFlow <no-reply@apexflow.id.vn>";

const smtpTransporter =
  smtpHost && smtpUser && smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })
    : null;

/**
 * Generates an elegant, modern HTML email template for ApexFlow OTP
 */
function getOtpEmailHtml(otp: string, recipientEmail: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác thực đăng nhập ApexFlow</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; overflow: hidden;" cellspacing="0" cellpadding="0">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #090d16; padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                ApexFlow <span style="color: #818cf8; font-size: 14px; font-weight: 500;">Cloud Platform</span>
              </h1>
              <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500;">
                Hệ thống Quản trị & Điều phối Nhân sự Thời trang
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 700;">
                Mã xác thực đăng nhập
              </h2>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Xin chào, chúng tôi nhận được yêu cầu đăng nhập vào tài khoản <strong style="color: #0f172a;">${recipientEmail}</strong> trên hệ thống ApexFlow.
              </p>

              <!-- OTP Code Box -->
              <div style="background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0;">
                <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">
                  Mã xác thực OTP (6 chữ số)
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4338ca; text-align: center;">
                  ${otp}
                </div>
              </div>

              <p style="margin: 20px 0 0 0; color: #ef4444; font-size: 12px; font-weight: 600; text-align: center;">
                ⏱️ Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã cho bất kỳ ai.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 11px;">
                Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ quản trị viên.
              </p>
              <p style="margin: 0; color: #cbd5e1; font-size: 11px;">
                © ${new Date().getFullYear()} ApexFlow Cloud Enterprise. Mọi quyền được bảo lưu.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Sends OTP Email to the user
 */
export async function sendOtpEmail(toEmail: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlContent = getOtpEmailHtml(otp, toEmail);

    // 1. Try Resend if configured
    if (resend) {
      let sendRes = await resend.emails.send({
        from: emailFrom,
        to: toEmail,
        subject: `[ApexFlow] Mã xác thực đăng nhập: ${otp}`,
        html: htmlContent,
      });

      // If custom domain is not yet verified on DNS, fallback to onboarding@resend.dev for testing
      if (sendRes.error && (sendRes.error.message?.includes("domain") || sendRes.error.message?.includes("verify"))) {
        console.warn("[Resend Warning]: Custom domain not verified yet, falling back to onboarding@resend.dev:", sendRes.error.message);
        sendRes = await resend.emails.send({
          from: "ApexFlow <onboarding@resend.dev>",
          to: toEmail,
          subject: `[ApexFlow] Mã xác thực đăng nhập: ${otp}`,
          html: htmlContent,
        });
      }

      if (sendRes.error) {
        console.error("[Email Resend Error]:", sendRes.error);
        return { success: false, error: sendRes.error.message };
      }
      return { success: true };
    }

    // 2. Try SMTP if configured
    if (smtpTransporter) {
      await smtpTransporter.sendMail({
        from: emailFrom,
        to: toEmail,
        subject: `[ApexFlow] Mã xác thực đăng nhập: ${otp}`,
        html: htmlContent,
      });
      return { success: true };
    }

    // 3. Dev / Sandbox Mode fallback: Log to console
    console.log("==================================================");
    console.log(`📨 [DEV EMAIL SIMULATOR] To: ${toEmail}`);
    console.log(`🔑 [OTP CODE]: ${otp}`);
    console.log("==================================================");

    return { success: true };
  } catch (err: any) {
    console.error("[Send Email Exception]:", err);
    return { success: false, error: err.message || "Lỗi gửi email xác thực" };
  }
}
