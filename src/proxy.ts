import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
