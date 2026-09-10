"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type Theme = "light" | "dark" | "system";

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "apexflow-theme";

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = STORAGE_KEY,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const pathname = usePathname();
  const isLandingPage =
    pathname === "/" ||
    pathname === "/home-apexflow" ||
    Boolean(pathname?.startsWith("/home-apexflow"));
  const isLoginPage = pathname === "/dang-nhap" || Boolean(pathname?.startsWith("/dang-nhap"));

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      const saved = localStorage.getItem(storageKey) as Theme | null;
      return saved && ["light", "dark", "system"].includes(saved) ? saved : defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Function to apply theme to document element
  const applyTheme = (targetTheme: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    let actualTheme: "light" | "dark" = "light";

    // Landing page is strictly light mode
    if (isLandingPage) {
      actualTheme = "light";
    } else {
      if (targetTheme === "system") {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        actualTheme = systemDark ? "dark" : "light";
      } else {
        actualTheme = targetTheme;
      }
    }

    if (actualTheme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    }

    setResolvedTheme(actualTheme);
  };

  useEffect(() => {
    applyTheme(theme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (isLandingPage) {
        applyTheme("light");
      } else if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, pathname, isLandingPage, isLoginPage]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (e) {
      console.error("Failed to save theme to localStorage", e);
    }

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        applyTheme(newTheme);
      });
    } else {
      applyTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
