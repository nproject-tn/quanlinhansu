"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { uploadToS3 } from "@/lib/s3-upload";

export async function createWorkspaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name")?.toString().trim();
  if (!name || name.length < 3) {
    throw new Error("Tên doanh nghiệp phải từ 3 ký tự trở lên");
  }

  const logoFile = formData.get("logo") as File | null;
  let logoUrl: string | null = null;
  
  if (logoFile && logoFile.size > 0) {
    try {
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      logoUrl = await uploadToS3(buffer, logoFile.name, logoFile.type);
    } catch (e: any) {
      console.error("Lỗi tải logo:", e);
      throw new Error(`Lỗi tải logo lên S3: ${e.message}`);
    }
  }

  // Create an SEO friendly ID from the name
  const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const id = `${baseId}-${Math.random().toString(36).substring(2, 6)}`;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Create the Company
      await tx.company.create({
        data: {
          id,
          name: name,
          logo: logoUrl,
        }
      });

      // 2. Create the Owner Membership
      await tx.companyMember.create({
        data: {
          userId: session.user.id,
          companyId: id,
          role: "OWNER",
        }
      });

      // 3. Create Default Schedule Config
      await tx.scheduleConfig.create({
        data: {
          companyId: id,
          shiftsPerDay: 3,
        }
      });
    });
  } catch (error) {
    console.error("Error creating workspace:", error);
    throw new Error("Không thể tạo doanh nghiệp. Tên có thể đã bị trùng.");
  }

  revalidatePath("/workspaces");
  redirect(`/app/${id}`);
}
