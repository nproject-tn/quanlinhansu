import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { UserRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    employeeId?: string | null;
    companyId?: string | null;
    isSuperAdmin?: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      employeeId?: string | null;
      companyId?: string | null;
      isSuperAdmin?: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    employeeId?: string | null;
    companyId?: string | null;
    isSuperAdmin?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? "",
          role: user.role ?? "EMPLOYEE",
          employeeId: user.employeeId,
          companyId: user.companyId,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
});

export function canManageSettings(role: UserRole): boolean {
  return role === "ADMIN" || role === "OWNER";
}

export function canManageSchedule(role: UserRole): boolean {
  return role === "ADMIN" || role === "OWNER" || role === "SCHEDULER";
}

export function canViewOwnScheduleOnly(role: UserRole): boolean {
  return role === "EMPLOYEE";
}
