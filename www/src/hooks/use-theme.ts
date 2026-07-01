import { use } from "react";

import { ThemeContext } from "@/lib/theme/theme-context";
import type { ThemeContextValue } from "@/lib/theme/theme-context";

function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export { useTheme };
