import { createContext } from "react";

export const THEME_STORAGE_KEY = "mc-tracker-theme";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export type SetThemeOptions = {
  transition?: boolean;
};

export type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference, options?: SetThemeOptions) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
