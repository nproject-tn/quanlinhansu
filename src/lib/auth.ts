import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
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
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // If logging in with Google, check if user already has a custom name in DB
      if (account?.provider === "google" && user?.email) {
        try {
          const cleanEmail = user.email.toLowerCase().trim();
          const existingUser = await prisma.user.findUnique({
            where: { email: cleanEmail },
            select: { id: true, name: true },
          });

          // If user exists and already has a name, preserve it and DO NOT overwrite with Google name!
          if (existingUser && existingUser.name) {
            user.name = existingUser.name;
          }
        } catch (err) {
          console.error("[Google SignIn Name Guard Error]:", err);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.companyId = user.companyId;
        token.isSuperAdmin = user.isSuperAdmin;
      }
      // Ensure token matches the current DB user by email
      if (token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: { id: true, name: true, role: true, employeeId: true, companyId: true, isSuperAdmin: true },
          });
          if (dbUser) {
            token.sub = dbUser.id;
            if (dbUser.name) {
              token.name = dbUser.name;
            }
            token.role = dbUser.role;
            token.employeeId = dbUser.employeeId;
            token.companyId = dbUser.companyId;
            token.isSuperAdmin = dbUser.isSuperAdmin;
          }
        } catch {
          // ignore error if db temporarily unavailable
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        if (token.name) {
          session.user.name = token.name;
        }
        session.user.role = token.role as UserRole;
        session.user.employeeId = token.employeeId as string | null | undefined;
        session.user.companyId = token.companyId as string | null | undefined;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean | undefined;

        // Double-check user in database to ensure the custom name is always used
        if (session.user.email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: session.user.email },
              select: { id: true, name: true, role: true, employeeId: true, companyId: true, isSuperAdmin: true },
            });
            if (dbUser) {
              session.user.id = dbUser.id;
              if (dbUser.name) {
                session.user.name = dbUser.name;
              }
              session.user.role = dbUser.role;
              session.user.employeeId = dbUser.employeeId;
              session.user.companyId = dbUser.companyId;
              session.user.isSuperAdmin = dbUser.isSuperAdmin;
            }
          } catch {
            // ignore
          }
        }
      }
      return session;
    },
  },
  providers: [
    ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
      ? [
          Apple({
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Mật khẩu", type: "password" },
        phone: { label: "Số điện thoại", type: "text" },
        otp: { label: "Mã OTP", type: "text" },
        authType: { label: "Loại xác thực", type: "text" },
        name: { label: "Họ tên", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const authType = String(credentials.authType || "password");

        // 1. Phone number authentication (SĐT)
        if (authType === "phone_otp" || credentials.phone) {
          const rawPhone = String(credentials.phone || "").replace(/\s+/g, "");
          if (!rawPhone || rawPhone.length < 8) return null;

          const phoneDigits = rawPhone.replace(/[^0-9]/g, "");
          const phoneEmail = `${phoneDigits}@phone.apexflow.id.vn`;

          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: phoneEmail },
                { email: rawPhone }
              ]
            }
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: phoneEmail,
                name: credentials.name ? String(credentials.name) : `Thành viên ${phoneDigits.slice(-4)}`,
                role: "EMPLOYEE",
              }
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? "",
            role: user.role ?? "EMPLOYEE",
            employeeId: user.employeeId,
            companyId: user.companyId,
            isSuperAdmin: user.isSuperAdmin,
          };
        }

        // 2. Email OTP / Magic passwordless login
        if (authType === "email_otp") {
          const email = String(credentials.email || "").trim().toLowerCase();
          const otp = String(credentials.otp || "").trim();
          if (!email || !email.includes("@")) return null;

          // If OTP code is provided, verify against VerificationToken
          if (otp) {
            const tokenRecord = await prisma.verificationToken.findFirst({
              where: {
                identifier: email,
                token: otp,
                expires: { gte: new Date() },
              },
            });

            // Allow token or dev fallback
            if (!tokenRecord && otp !== "123456") {
              return null;
            }

            // Clean up verified token
            if (tokenRecord) {
              try {
                await prisma.verificationToken.deleteMany({
                  where: { identifier: email },
                });
              } catch {}
            }
          }

          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: credentials.name ? String(credentials.name) : email.split("@")[0],
                role: "EMPLOYEE",
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? "",
            role: user.role ?? "EMPLOYEE",
            employeeId: user.employeeId,
            companyId: user.companyId,
            isSuperAdmin: user.isSuperAdmin,
          };
        }

        return null;
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
