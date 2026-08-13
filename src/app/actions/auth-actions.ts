"use server";

import { signOut } from "@/lib/auth";

export async function signOutAction(companyId?: string) {
  await signOut({ redirectTo: "/dang-nhap" });
}
