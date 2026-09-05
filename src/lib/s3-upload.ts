import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

async function getSharpInstance() {
  try {
    const s = await import("sharp");
    return s.default || s;
  } catch {
    return null;
  }
}

// Create an S3 client for Oracle Object Storage (or any S3 compatible API)
export const s3Client = new S3Client({
  region: process.env.S3_REGION || "ap-singapore-1",
  endpoint: process.env.S3_ENDPOINT, // e.g. "https://<namespace>.compat.objectstorage.<region>.oraclecloud.com"
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

export async function uploadToS3(
  buffer: Buffer, 
  filename: string, 
  mimetype: string
): Promise<string> {
  const bucketName = process.env.S3_BUCKET_NAME;
  
  // Optimize image with sharp if available
  let optimizedBuffer = buffer;
  let ext = "webp";
  let contentType = "image/webp";

  try {
    const sharpInstance = await getSharpInstance();
    if (sharpInstance) {
      optimizedBuffer = await sharpInstance(buffer)
        .resize(256, 256, { fit: "cover", withoutEnlargement: true }) // Max 256x256, crop to square
        .webp({ quality: 80 }) // Compress to WebP with 80% quality
        .toBuffer();
      ext = "webp";
      contentType = "image/webp";
    } else {
      throw new Error("sharp not available");
    }
  } catch (e) {
    console.warn("Image optimization with sharp skipped:", e);
    ext = filename.split(".").pop()?.toLowerCase() || "png";
    contentType = mimetype || (ext === "svg" ? "image/svg+xml" : "image/png");
  }
    
  const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.[^/.]+$/, "");
  const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${cleanFilename}.${ext}`;
  
  if (!bucketName || !process.env.S3_ENDPOINT) {
    // FALLBACK: Local file system upload if S3 is not configured
    const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
    
    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, uniqueFilename);
    await writeFile(filePath, optimizedBuffer);
    
    // Return local URL
    return `/uploads/logos/${uniqueFilename}`;
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: `logos/${uniqueFilename}`,
    Body: optimizedBuffer,
    ContentType: contentType,
    ACL: "public-read",
  });

  await s3Client.send(command);
  return `${process.env.S3_ENDPOINT}/${bucketName}/logos/${uniqueFilename}`;
}
