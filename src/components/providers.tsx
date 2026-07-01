"use client";

import { ConfirmDialogProvider } from "@/components/confirm/confirm-dialog-provider";
import { NotificationProvider } from "@/components/notifications/notification-center";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmDialogProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </ConfirmDialogProvider>
  );
}
