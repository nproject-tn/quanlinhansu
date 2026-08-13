import { handlers } from "@/lib/auth";
import rateLimit from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
});

const { GET, POST: AuthPost } = handlers;

export { GET };

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    // Limit to 5 login attempts per minute per IP
    await limiter.check(5, ip);
    return AuthPost(request);
  } catch {
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút." }, { status: 429 });
  }
}
