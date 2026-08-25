"use client";

import { ConfirmDialogProvider } from "@/components/confirm/confirm-dialog-provider";
import { NotificationProvider } from "@/components/notifications/notification-center";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system">
      <ConfirmDialogProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </ConfirmDialogProvider>
    </ThemeProvider>
  );
}

