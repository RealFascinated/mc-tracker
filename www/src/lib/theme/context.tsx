import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";

import {
  localStorageStringOptions,
  useLocalStorage,
} from "@/hooks/use-local-storage";
import { startThemeViewTransition } from "@/lib/theme/transition";
import { THEME_STORAGE_KEY, ThemeContext } from "@/lib/theme/theme-context";
import type {
  ResolvedTheme,
  SetThemeOptions,
  ThemePreference,
} from "@/lib/theme/theme-context";

function isThemePreference(value: string): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

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

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useLocalStorage(THEME_STORAGE_KEY, {
    defaultValue: "system",
    ...localStorageStringOptions,
    deserialize: (raw) => (isThemePreference(raw) ? raw : null),
  });
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
    [resolvedTheme, setThemeState, systemTheme, theme],
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
