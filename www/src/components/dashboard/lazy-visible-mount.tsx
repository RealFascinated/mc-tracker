import type { ReactNode } from "react";

import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { cn } from "@/lib/utils";

type LazyVisibleMountProps = {
  children: (isIntersecting: boolean) => ReactNode;
  placeholder?: ReactNode;
  className?: string;
};

export function LazyVisibleMount({
  children,
  placeholder = null,
  className,
}: LazyVisibleMountProps) {
  const { ref, isIntersecting, hasBeenVisible } = useIntersectionVisible();

  return (
    <div ref={ref} className={cn(className)}>
      {hasBeenVisible ? children(isIntersecting) : placeholder}
    </div>
  );
}
