import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";

import { startThemeViewTransition } from "@/lib/theme/transition";
import { THEME_STORAGE_KEY, ThemeContext } from "@/lib/theme/theme-context";
import type {
  ResolvedTheme,
  SetThemeOptions,
  ThemePreference,
} from "@/lib/theme/theme-context";

function subscribeToSystemTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getServerSystemThemeSnapshot(): ResolvedTheme {
  return "dark";
}

function getStoredTheme(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : null;
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getInitialPreference(): ThemePreference {
  return getStoredTheme() ?? "system";
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] =
    useState<ThemePreference>(getInitialPreference);
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getServerSystemThemeSnapshot,
  );

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (nextTheme: ThemePreference, options?: SetThemeOptions) => {
      if (nextTheme === theme) {
        return;
      }

      const nextResolved: ResolvedTheme =
        nextTheme === "system" ? systemTheme : nextTheme;
      const resolvedChanges = nextResolved !== resolvedTheme;

      const apply = () => {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextResolved);
        flushSync(() => {
          setThemeState(nextTheme);
        });
      };

      if (options?.transition && resolvedChanges) {
        startThemeViewTransition(apply);
        return;
      }

      apply();
    },
    [resolvedTheme, systemTheme, theme],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export { ThemeProvider };
