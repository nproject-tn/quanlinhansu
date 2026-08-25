import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "glass-control flex h-10 w-full rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none ring-slate-900 transition-[border-color,box-shadow] focus:border-slate-400 focus:ring-2 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:ring-neutral-400 dark:focus:border-neutral-500",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
