import { Moon, Sun } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";
  const Icon = isDark ? Sun : Moon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "site-header-nav-button text-muted-foreground hover:bg-transparent hover:text-monitor dark:hover:bg-transparent dark:hover:text-warning",
            className,
          )}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setTheme(nextTheme, {
              transition: true,
              transitionOrigin: {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              },
            });
          }}
          aria-label={label}
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
