import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Sanitize path to prevent directory traversal
    const safeSubPath = path.normalize(path.join(...pathSegments)).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(process.cwd(), "public", "uploads", safeSubPath);

    // Security check: ensure fullPath starts with uploadsBaseDir
    const uploadsBaseDir = path.join(process.cwd(), "public", "uploads");
    if (!fullPath.startsWith(uploadsBaseDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const fileBuffer = await readFile(fullPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
