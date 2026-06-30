import type { ReactNode } from "react";

import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { cn } from "@/lib/utils";

type LazyVisibleMountProps = {
  children: (isVisible: boolean) => ReactNode;
  className?: string;
};

export function LazyVisibleMount({
  children,
  className,
}: LazyVisibleMountProps) {
  const { ref, isVisible } = useIntersectionVisible();

  return (
    <div ref={ref} className={cn(className)}>
      {children(isVisible)}
    </div>
  );
}
