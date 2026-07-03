import type { CSSProperties, ElementType, ReactNode } from "react";

import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { cn } from "cnfast";

import "./fade-in-animation.css";

type FadeInAnimationProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
};

export function FadeInAnimation({
  children,
  className,
  delay = 0,
  as: Component = "div",
}: FadeInAnimationProps) {
  const { ref, hasBeenVisible } = useIntersectionVisible();

  const style: CSSProperties | undefined =
    hasBeenVisible && delay > 0 ? { animationDelay: `${delay}ms` } : undefined;

  return (
    <Component
      ref={ref}
      className={cn(
        hasBeenVisible
          ? "fade-in-animation-active"
          : "fade-in-animation-pending",
        className,
      )}
      style={style}
    >
      {children}
    </Component>
  );
}
