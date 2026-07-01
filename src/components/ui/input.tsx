import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "glass-control flex h-10 w-full rounded-xl px-3 py-2 text-sm text-slate-800 outline-none ring-blue-500 transition-[border-color,box-shadow] focus:border-blue-300 focus:ring-2",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
