import { Monitor, Moon, Sun } from "lucide-react";

import { SimpleTooltip } from "@/components/simple-tooltip";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";
import { useTheme } from "@/lib/theme";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const satisfies ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}>;

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm bg-muted p-0.5",
        className,
      )}
    >
      {themeOptions.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value;

        return (
          <SimpleTooltip key={value} content={`${label} theme`}>
            <button
              type="button"
              onClick={() => setTheme(value)}
              aria-label={label}
              aria-pressed={isActive}
              className={cn(
                "flex size-6 shrink-0 cursor-help items-center justify-center rounded-sm transition-colors",
                isActive
                  ? "bg-card text-monitor dark:bg-accent dark:text-warning"
                  : "text-muted-foreground hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          </SimpleTooltip>
        );
      })}
    </div>
  );
}
