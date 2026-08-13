"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  companyName: z.string().min(1, "Vui lòng nhập tên cửa hàng"),
});

export async function findCompany(prevState: any, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  
  const validatedFields = schema.safeParse(data);
  
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Dữ liệu không hợp lệ",
    };
  }
  
  const { companyName } = validatedFields.data;
  
  try {
    const searchName = companyName.trim();
    const company = await prisma.company.findFirst({
      where: { 
        name: {
          equals: searchName,
          mode: "insensitive"
        }
      },
    });
    
    if (!company) {
      return { error: "Không tìm thấy không gian làm việc này. Bạn đã nhập đúng tên chưa?" };
    }
    
    return { success: true, companyName: company.name, companyId: company.id };
  } catch (error) {
    console.error("Find company error:", error);
    return { error: "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau." };
  }
}
