import type { CSSProperties, ElementType, ReactNode } from "react";

import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { cn } from "@/lib/utils";

import "./slide-up-animation.css";

type SlideUpAnimationProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
};

export function SlideUpAnimation({
  children,
  className,
  delay = 0,
  as: Component = "div",
}: SlideUpAnimationProps) {
  const { ref, hasBeenVisible } = useIntersectionVisible();

  const style: CSSProperties | undefined =
    hasBeenVisible && delay > 0
      ? { animationDelay: `${delay}ms` }
      : undefined;

  return (
    <Component
      ref={ref}
      className={cn(
        hasBeenVisible
          ? "slide-up-animation-active"
          : "slide-up-animation-pending",
        className,
      )}
      style={style}
    >
      {children}
    </Component>
  );
}
