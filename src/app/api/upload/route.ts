import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { put } from "@vercel/blob";

export async function POST(request: Request) {
  const { error } = await requireAuth(["ADMIN", "SCHEDULER"]);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });
    }

    // Generate a unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFilename = `${uniqueSuffix}-${filename}`;

    const blob = await put(`evidence/${uniqueFilename}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: `Lỗi tải ảnh lên (${error.message || "Không xác định"}). Vui lòng kiểm tra lại cấu hình Vercel Blob.` }, 
      { status: 500 }
    );
  }
}
