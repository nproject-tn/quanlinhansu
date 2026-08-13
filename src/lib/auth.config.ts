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
      const isPublicPage = path === "/" || path === "/home-apexflow" || path.startsWith("/dang-nhap") || path.startsWith("/register");

      if (!isLoggedIn && !isPublicPage) return false;
      
      // Redirect logged-in users away from auth pages to their workspaces
      if (isLoggedIn && (path === "/" || path === "/home-apexflow" || path.startsWith("/dang-nhap") || path.startsWith("/register"))) {
        return Response.redirect(new URL("/workspaces", request.nextUrl));
      }

      // We will handle specific company route protection in the app/[companyId] layout/middleware
      // For now, allow logged in users to proceed
      return true;
    },
  },
  providers: [],
  session: {
    strategy: "jwt",
  },
  trustHost: true,
} satisfies NextAuthConfig;
