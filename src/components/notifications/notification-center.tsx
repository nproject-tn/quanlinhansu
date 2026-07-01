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
import { usePathname } from "next/navigation";
import { AlertCircle, AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationTone = "success" | "error" | "warning";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  tone: NotificationTone;
  dedupeKey: string;
  createdAt: number;
  read: boolean;
};

type NotifyInput = {
  title: string;
  body: string;
  tone: NotificationTone;
  dedupeKey?: string;
};

type NotificationContextValue = {
  notify: (input: NotifyInput) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function iconForTone(tone: NotificationTone) {
  if (tone === "success") return CheckCircle2;
  if (tone === "error") return AlertCircle;
  return AlertTriangle;
}

function toneClassName(tone: NotificationTone) {
  if (tone === "success") return "border-emerald-200/70 text-emerald-950";
  if (tone === "error") return "border-rose-200/70 text-rose-950";
  return "border-amber-200/70 text-amber-950";
}

function toneIconClassName(tone: NotificationTone) {
  if (tone === "success") return "text-emerald-500";
  if (tone === "error") return "text-rose-500";
  return "text-amber-500";
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [activeToastIds, setActiveToastIds] = useState<string[]>([]);
  const [closingToastIds, setClosingToastIds] = useState<string[]>([]);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<NotificationItem[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const notify = useCallback((input: NotifyInput) => {
    const signature = input.dedupeKey ?? `${input.title}|${input.body}|${input.tone}`;
    const now = Date.now();
    const existing = notificationsRef.current.find((item) => item.dedupeKey === signature);
    const nextId = existing?.id ?? `${now}-${Math.random().toString(36).slice(2, 8)}`;

    setNotifications((current) => {
      if (existing) {
        return current.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                title: input.title,
                body: input.body,
                tone: input.tone,
                dedupeKey: signature,
                createdAt: now,
                read: false,
              }
            : item
        );
      }

      const nextItem: NotificationItem = {
        id: nextId,
        title: input.title,
        body: input.body,
        tone: input.tone,
        dedupeKey: signature,
        createdAt: now,
        read: false,
      };

      return [nextItem, ...current].slice(0, 48);
    });

    setShowNotificationCenter(false);
    setClosingToastIds((current) => current.filter((id) => id !== nextId));
    setActiveToastIds((current) =>
      current.includes(nextId) ? current : [nextId, ...current].slice(0, 8)
    );
  }, []);

  useEffect(() => {
    if (!showNotificationCenter) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setShowNotificationCenter(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showNotificationCenter]);

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => b.createdAt - a.createdAt),
    [notifications]
  );
  const activeToasts = useMemo(
    () =>
      sortedNotifications.filter((item) => activeToastIds.includes(item.id)),
    [activeToastIds, sortedNotifications]
  );

  useEffect(() => {
    if (activeToastIds.length === 0) {
      setClosingToastIds([]);
      return;
    }

    const visibleIds = [...activeToastIds];
    setClosingToastIds([]);

    const hideTimer = window.setTimeout(() => {
      setClosingToastIds(visibleIds);
    }, 3000);
    const cleanupTimer = window.setTimeout(() => {
      setActiveToastIds((current) => current.filter((id) => !visibleIds.includes(id)));
      setClosingToastIds([]);
    }, 3260);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [activeToastIds]);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const value = useMemo(() => ({ notify }), [notify]);
  const shouldShowBell = pathname !== "/dang-nhap";

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {shouldShowBell && (
        <div
          ref={shellRef}
          className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col items-end gap-3"
        >
          <div className="pointer-events-auto relative">
            <button
              type="button"
              onClick={() => {
                if (activeToastIds.length > 0) {
                  setActiveToastIds([]);
                  setClosingToastIds([]);
                  setShowNotificationCenter(false);
                  setNotifications((current) => current.map((item) => ({ ...item, read: true })));
                  return;
                }

                setShowNotificationCenter((current) => !current);
                setNotifications((current) => current.map((item) => ({ ...item, read: true })));
              }}
              className="toast-liquid flex h-12 w-12 items-center justify-center rounded-2xl border-slate-200/70 text-slate-700 transition-transform hover:scale-[1.02]"
              aria-label="Mở thông báo"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && activeToastIds.length > 0 && (
                <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(255,255,255,0.5)]" />
              )}
            </button>
          </div>

          {activeToasts.length > 0 ? (
            <div className="flex w-full flex-col gap-3">
              {activeToasts.map((toast) => {
                const Icon = iconForTone(toast.tone);
                const isClosing = closingToastIds.includes(toast.id);
                return (
                  <div
                    key={`toast-${toast.id}`}
                    className={cn(
                      "toast-liquid pointer-events-auto w-full",
                      isClosing ? "toast-exit" : "toast-enter",
                      toneClassName(toast.tone)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", toneIconClassName(toast.tone))} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{toast.title}</p>
                        <p className="mt-1 text-sm opacity-85">{toast.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {showNotificationCenter && (
            <div className="toast-liquid toast-enter pointer-events-auto w-full border-slate-200/70 text-slate-900">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/45 pb-3">
                <div>
                  <p className="text-sm font-semibold">Thông báo</p>
                </div>
              </div>
              <div className="hover-scrollbars max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                {sortedNotifications.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Chưa có thông báo nào.</p>
                ) : null}
                {sortedNotifications.map((notification) => {
                  const Icon = iconForTone(notification.tone);
                  return (
                    <div
                      key={notification.id}
                      className="flex items-start gap-3 rounded-2xl border border-white/35 bg-white/28 px-3 py-3"
                    >
                      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", toneIconClassName(notification.tone))} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="mt-1 text-sm text-slate-700/80">{notification.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
