import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { uploadToS3 } from "@/lib/s3-upload";

export async function POST(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER", "OWNER"]);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToS3(buffer, file.name, file.type);

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error("POST /api/upload/s3 error:", error);
    return NextResponse.json(
      { error: `Lỗi tải ảnh lên (${error.message || "Không xác định"}). Vui lòng kiểm tra lại cấu hình S3.` }, 
      { status: 500 }
    );
  }
}
