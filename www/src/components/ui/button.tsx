import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex min-w-fit shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm border-2 border-transparent bg-clip-padding px-2 text-sm font-medium whitespace-nowrap normal-case transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-monitor focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:border-border aria-disabled:bg-muted aria-disabled:text-muted-foreground aria-disabled:opacity-100 dark:focus-visible:ring-warning dark:focus-visible:ring-offset-base dark:disabled:border-border dark:disabled:bg-muted/60 dark:disabled:text-muted-foreground dark:aria-disabled:border-border dark:aria-disabled:bg-muted/60 dark:aria-disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-border bg-card text-foreground hover:bg-muted dark:hover:bg-muted",
        highlighted:
          "border-monitor bg-monitor-50 text-monitor-200 hover:bg-monitor hover:text-white dark:border-monitor-100 dark:bg-monitor/20 dark:text-white dark:hover:bg-monitor-100 dark:hover:text-white",
        brand:
          "border-monitor bg-monitor text-white hover:bg-monitor-100 dark:border-monitor-100 dark:bg-monitor/90 dark:hover:bg-monitor-100",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white dark:border-destructive/60 dark:bg-destructive/20 dark:text-destructive dark:hover:bg-destructive dark:hover:text-white",
        outline:
          "border-border bg-transparent text-foreground hover:bg-muted dark:hover:bg-muted",
        secondary:
          "border-border bg-muted text-foreground hover:bg-accent dark:hover:bg-accent",
        ghost:
          "border-transparent text-foreground hover:bg-muted dark:hover:bg-muted",
        link: "h-auto border-transparent bg-transparent p-0 text-monitor underline-offset-4 hover:underline dark:text-warning",
      },
      size: {
        default: "h-8 has-[>svg]:px-2",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-2 text-sm has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-3 has-[>svg]:px-3",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
