"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

const registerSchema = z.object({
  companyName: z.string().min(2, "Tên công ty phải có ít nhất 2 ký tự"),
  userName: z.string().min(2, "Tên của bạn phải có ít nhất 2 ký tự"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

export async function registerCompany(prevState: any, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  
  const validatedFields = registerSchema.safeParse(data);
  
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Dữ liệu không hợp lệ",
    };
  }
  
  const { companyName, userName, email, password } = validatedFields.data;
  
  try {
    // Check if companyName exists
    const existingCompany = await prisma.company.findUnique({
      where: { name: companyName },
    });
    
    if (existingCompany) {
      return { error: "Tên cửa hàng/công ty này đã được đăng ký. Vui lòng chọn tên khác." };
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return { error: "Email này đã được sử dụng" };
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Use transaction to create Company and Admin User together
    await prisma.$transaction(async (tx) => {
      // 1. Create Company
      const company = await tx.company.create({
        data: {
          name: companyName,
        },
      });
      
      // 2. Create User (Admin)
      await tx.user.create({
        data: {
          email,
          passwordHash,
          name: userName,
          role: "ADMIN",
          companyId: company.id,
        },
      });
      
      // 3. Create default Schedule Config for the company
      await tx.scheduleConfig.create({
        data: {
          companyId: company.id,
          shiftsPerDay: 3,
        }
      });
    });
    
  } catch (error) {
    console.error("Registration error:", error);
    return { error: "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau." };
  }
  
  // Redirect to login page on success
  redirect("/dang-nhap?registered=true");
}
