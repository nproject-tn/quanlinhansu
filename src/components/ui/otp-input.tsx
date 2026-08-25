"use client";

import React, { useRef, useEffect } from "react";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function OtpInput({
  length = 6,
  value = "",
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  className = "",
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split string into array of length
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  // Auto focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Handle single digit input or autofill
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const rawVal = e.target.value;
    const cleanDigits = rawVal.replace(/\D/g, "");

    if (!cleanDigits) {
      // User cleared the box
      const newOtp = digits.map((d, i) => (i === index ? "" : d)).join("");
      onChange(newOtp);
      return;
    }

    // If pasted or OS autofilled multiple characters
    if (cleanDigits.length > 1) {
      const newDigits = cleanDigits.slice(0, length);
      onChange(newDigits);

      const nextFocusIndex = Math.min(newDigits.length, length - 1);
      inputRefs.current[nextFocusIndex]?.focus();

      if (newDigits.length === length && onComplete) {
        onComplete(newDigits);
      }
      return;
    }

    // Single digit typed
    const singleDigit = cleanDigits.slice(-1);
    const newOtpArr = [...digits];
    newOtpArr[index] = singleDigit;
    const newOtp = newOtpArr.join("");
    onChange(newOtp);

    // Auto-advance to next input
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Trigger complete if full
    if (newOtp.length === length && onComplete) {
      onComplete(newOtp);
    }
  };

  // Handle backspace, arrows, and delete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Move to previous box and delete
        e.preventDefault();
        const newOtpArr = [...digits];
        newOtpArr[index - 1] = "";
        const newOtp = newOtpArr.join("");
        onChange(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle clipboard paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain");
    const cleanDigits = pastedData.replace(/\D/g, "").slice(0, length);

    if (cleanDigits) {
      onChange(cleanDigits);
      const nextFocusIndex = Math.min(cleanDigits.length, length - 1);
      inputRefs.current[nextFocusIndex]?.focus();

      if (cleanDigits.length === length && onComplete) {
        onComplete(cleanDigits);
      }
    }
  };

  return (
    <div className={`flex items-center justify-between gap-1.5 sm:gap-2 ${className}`}>
      {Array.from({ length }).map((_, index) => {
        const isFilled = Boolean(digits[index]);
        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={index === 0 ? length : 1}
            value={digits[index]}
            disabled={disabled}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`w-11 h-12 sm:w-12 sm:h-13 text-center text-lg sm:text-xl font-bold font-mono rounded-lg sm:rounded-xl border transition-all outline-none bg-white ${
              isFilled
                ? "border-slate-900 text-slate-900 bg-slate-50/40 shadow-xs"
                : "border-slate-200 text-slate-700 hover:border-slate-300"
            } focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:bg-white`}
          />
        );
      })}
    </div>
  );
}
