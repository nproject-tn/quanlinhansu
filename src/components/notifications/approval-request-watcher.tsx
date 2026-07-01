"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "@/components/notifications/notification-center";

type ApprovalSummary = {
  id: string;
  message: string;
};

async function readJsonSafely<T>(response: Response, fallback: T): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return fallback;

  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function ApprovalRequestWatcher({ enabled }: { enabled: boolean }) {
  const { notify } = useNotifications();
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function checkPendingApprovals() {
      const res = await fetch("/api/schedule/approval-requests");
      if (!res.ok || cancelled) return;

      const requests = await readJsonSafely<ApprovalSummary[]>(res, []);
      const signature = requests.map((request) => request.id).join("|");
      if (!signature || signature === lastSignatureRef.current) return;

      lastSignatureRef.current = signature;
      notify({
        title: `${requests.length} yêu cầu chờ duyệt`,
        body: requests[0]?.message ?? "Có yêu cầu xếp ca cần quản lí xác nhận.",
        tone: "warning",
        dedupeKey: `schedule-approval-requests|${signature}`,
      });
    }

    void checkPendingApprovals();
    const intervalId = window.setInterval(checkPendingApprovals, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, notify]);

  return null;
}
