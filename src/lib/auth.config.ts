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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
        session.user.employeeId = token.employeeId as string | null | undefined;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = request.nextUrl.pathname === "/dang-nhap";

      if (!isLoggedIn && !isLoginPage) return false;
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      const role = auth?.user?.role;
      const path = request.nextUrl.pathname;

      if (
        role === "EMPLOYEE" &&
        (path.startsWith("/nhan-vien") ||
          path.startsWith("/cua-hang") ||
          path.startsWith("/cau-hinh-ca"))
      ) {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      if (
        role === "SCHEDULER" &&
        (path.startsWith("/cua-hang") || path.startsWith("/cau-hinh-ca"))
      ) {
        return Response.redirect(new URL("/lich-xep-ca", request.nextUrl));
      }

      return true;
    },
  },
  providers: [],
  session: {
    strategy: "jwt",
  },
  trustHost: true,
} satisfies NextAuthConfig;
