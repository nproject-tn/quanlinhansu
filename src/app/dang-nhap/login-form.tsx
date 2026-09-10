"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  Smartphone,
  User,
  ArrowRight,
} from "lucide-react";

interface LoginFormProps {
  currentSessionUser?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;
}

export function LoginForm({ currentSessionUser }: LoginFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/workspaces";
  const registered = searchParams.get("registered");
  const authError = searchParams.get("error");

  // Auth Modes: 'default' | 'phone' | 'email_otp' | 'name_onboarding'
  const [authMode, setAuthMode] = useState<"default" | "phone" | "email_otp" | "name_onboarding">("default");
  
  // Email states (100% Passwordless OTP)
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailCountdown, setEmailCountdown] = useState(60);

  // Name Onboarding for first-time email users
  const [fullName, setFullName] = useState("");

  // Email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email.trim());
  const showEmailError = emailTouched && email.trim().length > 0 && !isEmailValid;

  // Phone states
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [countdown, setCountdown] = useState(60);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Handle countdown for Phone OTP
  useEffect(() => {
    let timer: any;
    if (otpSent && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpSent, countdown]);

  // Handle countdown for Email OTP
  useEffect(() => {
    let timer: any;
    if (authMode === "email_otp" && emailCountdown > 0) {
      timer = setInterval(() => setEmailCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [authMode, emailCountdown]);

  // Google One-Tap for Chrome
  const handleGoogleOneTapCredential = async (response: any) => {
    try {
      setLoading(true);
      setErrorMsg("");
      await signIn("google", { callbackUrl });
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi đăng nhập qua Google One Tap");
    } finally {
      setLoading(false);
    }
  };

  const initGoogleOneTap = () => {
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      const clientId =
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
        "494148953127-u8rl3cid4fn894ji1mdjl5e69gor64fh.apps.googleusercontent.com";
      
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleOneTapCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
        });

        (window as any).google.accounts.id.prompt((notification: any) => {
          if (
            notification?.isNotDisplayed?.() ||
            notification?.isSkippedMoment?.() ||
            notification?.isDismissedMoment?.()
          ) {
            // Handled silently
          }
        });
      } catch (err) {
        // Silently catch initialization errors
      }
    }
  };

  // Clean up any active Google One Tap / FedCM prompts on component unmount
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event?.reason?.name === "AbortError" ||
        event?.reason?.message?.includes?.("signal is aborted") ||
        event?.reason?.message?.includes?.("FedCM")
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.cancel();
        } catch {}
      }
    };
  }, []);

  // 1. Handle Google Login (Priority #1)
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      await signIn("google", { callbackUrl });
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể kết nối đến Google");
      setLoading(false);
    }
  };

  // 2. Handle Request Email OTP
  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setEmailTouched(true);
      setErrorMsg("Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        setErrorMsg(data.error || "Không thể gửi mã OTP qua email");
      } else {
        setAuthMode("email_otp");
        setEmailOtpCode("");
        setEmailCountdown(60);
        setSuccessMsg(`Mã OTP 6 số đã được gửi tới ${cleanEmail}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi khi gửi mã xác thực email");
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Verify Email OTP (Checks if first-time user needs name onboarding)
  const handleVerifyEmailOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || emailOtpCode).trim();
    if (!code || code.length < 6) {
      setErrorMsg("Vui lòng nhập đủ 6 chữ số mã OTP");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        otp: code,
        authType: "email_otp",
        callbackUrl,
        redirect: false,
      });

      if (res?.error) {
        setErrorMsg("Mã OTP không chính xác hoặc đã hết hạn (5 phút)");
        setLoading(false);
        return;
      }

      // Check if user is signing in for the first time and needs Name Onboarding
      try {
        const userRes = await fetch("/api/users/me");
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.needsNameOnboarding) {
            setAuthMode("name_onboarding");
            setLoading(false);
            return;
          }
        }
      } catch {
        // fallback to standard redirect if check fails
      }

      router.push(callbackUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi xác thực mã OTP email");
      setLoading(false);
    }
  };

  // 4. Handle Name Onboarding Submit
  const handleNameOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMsg("Vui lòng nhập họ và tên của bạn (ít nhất 2 ký tự)");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || "Không thể cập nhật họ tên");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi khi lưu họ tên");
      setLoading(false);
    }
  };

  // 5. Handle Phone OTP Request & Submit
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 9 || cleanPhone.length > 11) {
      setErrorMsg("Vui lòng nhập số điện thoại hợp lệ (9 - 11 chữ số)");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
      setOtpCode("");
      setCountdown(60);
      setSuccessMsg(`Mã xác thực đã gửi tới số ${phone}. (Mã thử nghiệm: 123456)`);
    }, 600);
  };

  const handleVerifyPhoneOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (!code || code.length < 4) {
      setErrorMsg("Vui lòng nhập mã OTP xác thực");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await signIn("credentials", {
        phone: phone.trim(),
        otp: code,
        authType: "phone_otp",
        callbackUrl,
        redirect: false,
      });

      if (res?.error) {
        setErrorMsg("Mã OTP không chính xác hoặc đã hết hạn");
      } else {
        router.push(callbackUrl);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi xác thực số điện thoại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Google One Tap script loader */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGoogleOneTap}
      />
      <div id="google-one-tap-container" className="fixed top-4 right-4 z-50 pointer-events-auto" />

      <div className="w-full space-y-4">
        {/* Centered Brand Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 mb-5">
          <img
            src="/logo-shape.svg"
            alt="ApexFlow"
            className="h-10 w-10 object-contain drop-shadow-sm mb-1 grayscale dark:invert"
          />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {authMode === "name_onboarding"
              ? "Hoàn tất thông tin cá nhân"
              : "Chào mừng đến với ApexFlow"}
          </h1>
          <p className="text-xs text-slate-400 dark:text-neutral-400 font-medium">
            {authMode === "name_onboarding"
              ? "Vui lòng nhập họ và tên của bạn để hiển thị trong Không gian làm việc"
              : "Đăng nhập để vào không gian làm việc"}
          </p>
        </div>

        {/* Notifications & Alerts */}
        {registered && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Đăng ký thành công! Hãy đăng nhập để bắt đầu.</span>
          </div>
        )}

        {authError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Đăng nhập thất bại. Vui lòng thử lại.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ===================== AUTH MODE: DEFAULT ===================== */}
        {authMode === "default" && (
          <div className="space-y-3">
            {/* ACTIVE SESSION CARD (IF ALREADY LOGGED IN) */}
            {currentSessionUser && (
              <div className="rounded-xl border border-slate-200/90 dark:border-neutral-800 bg-slate-50/80 dark:bg-[#202024] p-3.5 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                    {currentSessionUser.name ? currentSessionUser.name[0].toUpperCase() : (currentSessionUser.email?.[0]?.toUpperCase() || "U")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {currentSessionUser.name || "Tài khoản hiện tại"}
                      </p>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Đang đăng nhập
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono truncate">
                      {currentSessionUser.email}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => router.push(callbackUrl)}
                  className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <span>Tiếp tục với tài khoản này</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* DIVIDER IF ACTIVE SESSION */}
            {currentSessionUser && (
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-neutral-800" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white dark:bg-[#18181B] px-2.5 text-slate-400 dark:text-neutral-400 font-semibold tracking-wider">
                    hoặc đăng nhập với tài khoản khác
                  </span>
                </div>
              </div>
            )}

            {/* 1. GOOGLE SIGN IN (Ưu tiên #1) */}
            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-10 bg-white hover:bg-slate-50 text-slate-800 dark:bg-[#202024] dark:hover:bg-[#28282C] dark:text-white border border-slate-200 dark:border-neutral-700 font-medium shadow-none transition-all flex items-center justify-center gap-2.5 rounded-lg text-xs sm:text-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4 shrink-0">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                  <span>Tiếp tục với Google</span>
                </>
              )}
            </Button>

            {/* 2. PHONE NUMBER SIGN IN (TẠM THỜI BẢO TRÌ) */}
            <Button
              type="button"
              onClick={() => {
                setSuccessMsg("");
                setErrorMsg("Phương thức đăng nhập bằng Số điện thoại đang bảo trì. Vui lòng chọn phương án đăng nhập bằng Google hoặc Email.");
              }}
              className="w-full h-10 bg-white hover:bg-slate-50 text-slate-800 dark:bg-[#202024] dark:hover:bg-[#28282C] dark:text-white border border-slate-200 dark:border-neutral-700 font-medium shadow-none transition-all flex items-center justify-center gap-2.5 rounded-lg text-xs sm:text-sm"
            >
              <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Tiếp tục với Số điện thoại</span>
            </Button>

            {/* DIVIDER */}
            <div className="relative my-3.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-neutral-800" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white dark:bg-[#18181B] px-2.5 text-slate-400 dark:text-neutral-400 font-medium">
                  hoặc tiếp tục với email
                </span>
              </div>
            </div>

            {/* MINIMALIST PASSWORDLESS EMAIL INPUT & BUTTON */}
            <form onSubmit={handleEmailSubmit} className="space-y-2.5" noValidate>
              <div className="space-y-1.5">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (!emailTouched) setEmailTouched(true);
                    setErrorMsg("");
                  }}
                  onBlur={() => {
                    if (email.trim().length > 0) setEmailTouched(true);
                  }}
                  placeholder="Enter your email"
                  className={`h-10 rounded-lg bg-white dark:bg-[#202024] border text-xs sm:text-sm px-3 transition-colors dark:text-white dark:placeholder:text-neutral-500 ${
                    showEmailError
                      ? "border-rose-400 focus-visible:ring-rose-400 text-rose-900 dark:text-rose-300"
                      : "border-slate-200 dark:border-neutral-700 focus-visible:ring-slate-400 dark:focus-visible:ring-neutral-500"
                  }`}
                  required
                />

                {showEmailError && (
                  <p className="text-[11px] text-rose-500 font-normal leading-tight px-0.5 animate-in fade-in slide-in-from-top-1">
                    Please enter your email address using the format name@example.com
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={!isEmailValid || loading}
                className={`w-full h-10 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center ${
                  isEmailValid && !loading
                    ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm cursor-pointer"
                    : "bg-slate-100 dark:bg-[#202024] text-slate-400 dark:text-neutral-600 hover:bg-slate-100 dark:hover:bg-[#202024] cursor-not-allowed border-0 shadow-none font-medium"
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </div>
        )}

        {/* ===================== AUTH MODE: EMAIL OTP ===================== */}
        {authMode === "email_otp" && (
          <div className="space-y-3.5 animate-in fade-in">
            <button
              type="button"
              onClick={() => {
                setAuthMode("default");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white font-semibold"
            >
              <ChevronLeft className="h-4 w-4" /> Quay lại
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyEmailOtp();
              }}
              className="space-y-3.5"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
                    Nhập mã OTP Email (6 số)
                  </label>
                  <span className="text-xs text-slate-500 dark:text-neutral-400 font-mono">
                    {emailCountdown > 0 ? `${emailCountdown}s` : "Hết hạn"}
                  </span>
                </div>

                {/* 6-DIGIT OTP CELLS WITH AUTO-FOCUS & AUTO-FILL */}
                <OtpInput
                  length={6}
                  value={emailOtpCode}
                  onChange={(val) => {
                    setEmailOtpCode(val);
                    setErrorMsg("");
                  }}
                  onComplete={(val) => {
                    handleVerifyEmailOtp(val);
                  }}
                  disabled={loading}
                />

                <p className="text-[11px] text-slate-500 dark:text-neutral-400 text-center pt-1">
                  Mã xác thực đã được gửi tới hòm thư <strong className="text-slate-800 dark:text-white">{email}</strong>
                </p>
              </div>

              <Button
                type="submit"
                disabled={emailOtpCode.length < 6 || loading}
                className={`w-full h-10 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center ${
                  emailOtpCode.length === 6 && !loading
                    ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm cursor-pointer"
                    : "bg-slate-100 dark:bg-[#202024] text-slate-400 dark:text-neutral-600 hover:bg-slate-100 dark:hover:bg-[#202024] cursor-not-allowed border-0 shadow-none font-medium"
                }`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : "Xác nhận & Đăng nhập"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  disabled={emailCountdown > 0 || loading}
                  onClick={() => handleEmailSubmit()}
                  className="text-xs text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white disabled:text-slate-400 dark:disabled:text-neutral-600 font-medium underline underline-offset-2"
                >
                  Gửi lại mã OTP
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================== AUTH MODE: NAME ONBOARDING (LẦN ĐẦU) ===================== */}
        {authMode === "name_onboarding" && (
          <div className="space-y-3.5 animate-in fade-in">
            <form onSubmit={handleNameOnboardingSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
                  Họ và tên của bạn
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-neutral-500" />
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setErrorMsg("");
                    }}
                    placeholder="Ví dụ: Nguyễn Thành Nam"
                    className="h-10 rounded-lg bg-white dark:bg-[#202024] border border-slate-200 dark:border-neutral-700 focus-visible:ring-slate-400 dark:focus-visible:ring-neutral-500 text-xs sm:text-sm pl-9 pr-3 text-slate-900 dark:text-white"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-neutral-500">
                  Tên này sẽ được hiển thị khi bạn quản lý chuỗi cửa hàng, ca làm việc và nhân sự.
                </p>
              </div>

              <Button
                type="submit"
                disabled={fullName.trim().length < 2 || loading}
                className={`w-full h-10 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  fullName.trim().length >= 2 && !loading
                    ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm cursor-pointer"
                    : "bg-slate-100 dark:bg-[#202024] text-slate-400 dark:text-neutral-600 hover:bg-slate-100 dark:hover:bg-[#202024] cursor-not-allowed border-0 shadow-none font-medium"
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  <>
                    <span>Bắt đầu làm việc</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* ===================== AUTH MODE: PHONE NUMBER ===================== */}
        {authMode === "phone" && (
          <div className="space-y-3.5 animate-in fade-in">
            <button
              type="button"
              onClick={() => {
                setAuthMode("default");
                setOtpSent(false);
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white font-semibold"
            >
              <ChevronLeft className="h-4 w-4" /> Quay lại
            </button>

            {!otpSent ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-neutral-400 border-r pr-2 border-slate-300 dark:border-neutral-700">
                      <span>🇻🇳</span>
                      <span>+84</span>
                    </div>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912 345 678"
                      className="pl-16 h-10 rounded-lg bg-slate-50/70 dark:bg-[#202024] border-slate-200 dark:border-neutral-700 focus:bg-white dark:focus:bg-[#202024] text-slate-900 dark:text-white text-xs sm:text-sm font-medium"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 font-semibold rounded-lg shadow-sm transition-all text-xs sm:text-sm"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gửi mã xác thực OTP"}
                </Button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyPhoneOtp();
                }}
                className="space-y-3.5"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
                      Nhập mã OTP (6 số)
                    </label>
                    <span className="text-xs text-slate-500 dark:text-neutral-400 font-mono">
                      {countdown > 0 ? `${countdown}s` : "Hết hạn"}
                    </span>
                  </div>

                  {/* 6-DIGIT OTP CELLS FOR PHONE */}
                  <OtpInput
                    length={6}
                    value={otpCode}
                    onChange={(val) => {
                      setOtpCode(val);
                      setErrorMsg("");
                    }}
                    onComplete={(val) => {
                      handleVerifyPhoneOtp(val);
                    }}
                    disabled={loading}
                  />

                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 text-center pt-1">
                    Mã xác thực đã gửi tới số <strong className="text-slate-800 dark:text-white">{phone}</strong>
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={otpCode.length < 6 || loading}
                  className={`w-full h-10 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center ${
                    otpCode.length === 6 && !loading
                      ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-sm cursor-pointer"
                      : "bg-slate-100 dark:bg-[#202024] text-slate-400 dark:text-neutral-600 hover:bg-slate-100 dark:hover:bg-[#202024] cursor-not-allowed border-0 shadow-none font-medium"
                  }`}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : "Xác nhận & Đăng nhập"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    disabled={countdown > 0}
                    onClick={handleSendPhoneOtp}
                    className="text-xs text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white disabled:text-slate-400 dark:disabled:text-neutral-600 font-medium underline underline-offset-2"
                  >
                    Gửi lại mã OTP
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer info & Link */}
        <div className="pt-3 text-center space-y-1.5 border-t border-slate-100 dark:border-neutral-800">
          <p className="text-[10px] text-slate-400 dark:text-neutral-500 leading-relaxed">
            Bằng việc tiếp tục, bạn đồng ý với{" "}
            <a href="/home-apexflow" className="text-slate-600 dark:text-neutral-400 underline hover:text-slate-900 dark:hover:text-white">
              Điều khoản dịch vụ
            </a>{" "}
            và{" "}
            <a href="/home-apexflow" className="text-slate-600 dark:text-neutral-400 underline hover:text-slate-900 dark:hover:text-white">
              Chính sách quyền riêng tư
            </a>.
          </p>
        </div>
      </div>
    </>
  );
}
