import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/generated/prisma/client";

export const authConfig = {
  pages: {
    signIn: "/dang-nhap",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.companyId = user.companyId;
        token.isSuperAdmin = user.isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
        session.user.employeeId = token.employeeId as string | null | undefined;
        session.user.companyId = token.companyId as string | null | undefined;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean | undefined;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isPublicPage =
        path === "/" ||
        path === "/home-apexflow" ||
        path.startsWith("/dang-nhap") ||
        path.startsWith("/register") ||
        path.startsWith("/api/auth");

      if (!isLoggedIn && !isPublicPage) return false;

      // Allow logged-in and guest users to freely access public pages or proceed to protected routes
      return true;
    },
  },
  providers: [],
  session: {
    strategy: "jwt",
  },
  trustHost: true,
} satisfies NextAuthConfig;
