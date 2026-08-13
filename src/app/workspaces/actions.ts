"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { uploadToS3 } from "@/lib/s3-upload";

export async function uploadCompanyLogoAction(companyId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Verify membership and role
  const membership = await prisma.companyMember.findFirst({
    where: {
      companyId,
      userId: session.user.id,
      role: { in: ["OWNER", "ADMIN"] },
    }
  });

  if (!membership) {
    throw new Error("Không có quyền chỉnh sửa logo cho doanh nghiệp này");
  }

  const logoFile = formData.get("logo") as File | null;
  if (!logoFile || logoFile.size === 0) {
    throw new Error("Không tìm thấy file hợp lệ");
  }

  try {
    const buffer = Buffer.from(await logoFile.arrayBuffer());
    const logoUrl = await uploadToS3(buffer, logoFile.name, logoFile.type);

    await prisma.company.update({
      where: { id: companyId },
      data: { logo: logoUrl },
    });

    revalidatePath("/workspaces");
    return { success: true, logoUrl };
  } catch (error: any) {
    console.error("Error uploading logo:", error);
    throw new Error(`Lỗi tải logo: ${error.message}`);
  }
}

export async function deleteCompanyLogoAction(companyId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Verify membership and role
  const membership = await prisma.companyMember.findFirst({
    where: {
      companyId,
      userId: session.user.id,
      role: { in: ["OWNER", "ADMIN"] },
    }
  });

  if (!membership) {
    throw new Error("Không có quyền xoá logo cho doanh nghiệp này");
  }

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { logo: null },
    });

    revalidatePath("/workspaces");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting logo:", error);
    throw new Error(`Lỗi xoá logo: ${error.message}`);
  }
}
