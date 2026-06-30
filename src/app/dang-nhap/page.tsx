import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  const params = searchParams ? await searchParams : undefined;
  const errorMessage =
    params?.error === "CredentialsSignin"
      ? "Email hoặc mật khẩu không đúng"
      : params?.error
        ? "Không thể đăng nhập. Vui lòng thử lại."
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <p className="text-sm font-semibold text-blue-600">Apexflow HR</p>
          <CardTitle>Đăng nhập hệ thống</CardTitle>
          <p className="text-sm text-slate-500">Quản lý nhân sự & xếp ca</p>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <Input type="email" name="email" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Mật khẩu</label>
              <Input type="password" name="password" required />
            </div>
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            <Button type="submit" className="w-full">
              Đăng nhập
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

async function loginAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = error.type === "CredentialsSignin" ? "CredentialsSignin" : "AuthError";
      redirect(`/dang-nhap?error=${code}`);
    }
    throw error;
  }
}
