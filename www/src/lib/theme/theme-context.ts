import { createContext } from "react";

export const THEME_STORAGE_KEY = "mc-tracker-theme";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export type ThemeTransitionOrigin = {
  x: number;
  y: number;
};

export type SetThemeOptions = {
  transition?: boolean;
  transitionOrigin?: ThemeTransitionOrigin;
};

export type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference, options?: SetThemeOptions) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
