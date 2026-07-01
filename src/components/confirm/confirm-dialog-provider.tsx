"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const closeDialog = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending(options);
    });
  }, []);

  useEffect(() => {
    if (!pending) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) {
        closeDialog(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeDialog, pending]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/18 px-4 backdrop-blur-sm">
          <div
            ref={dialogRef}
            className="month-picker-liquid month-picker-liquid-solid relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/55 p-5 text-slate-900 shadow-2xl"
          >
            <div className="relative z-10 flex items-start gap-4">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-white/70",
                  pending.tone === "destructive"
                    ? "border-rose-200 text-rose-500"
                    : "border-amber-200 text-amber-500"
                )}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-900">{pending.title}</h3>
                {pending.description ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                    {pending.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="relative z-10 mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="glass-control border-slate-200/80 bg-white/70 hover:bg-white/85"
                onClick={() => closeDialog(false)}
              >
                {pending.cancelLabel ?? "Huỷ"}
              </Button>
              <Button
                type="button"
                variant={pending.tone === "destructive" ? "destructive" : "default"}
                className={cn(
                  pending.tone === "destructive"
                    ? "shadow-[0_12px_28px_rgba(225,29,72,0.22)]"
                    : "shadow-[0_12px_28px_rgba(37,99,235,0.22)]"
                )}
                onClick={() => closeDialog(true)}
              >
                {pending.confirmLabel ?? "Xác nhận"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return context;
}
