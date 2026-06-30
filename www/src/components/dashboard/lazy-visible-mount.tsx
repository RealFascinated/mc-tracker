import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { useIntersectionVisible } from "@/hooks/use-intersection-visible";
import { cn } from "@/lib/utils";

type LazyVisibleMountProps = {
  children: (isVisible: boolean) => ReactNode;
  placeholder?: ReactNode;
  className?: string;
};

export function LazyVisibleMount({
  children,
  placeholder = null,
  className,
}: LazyVisibleMountProps) {
  const { ref, isVisible } = useIntersectionVisible();
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setActivated(true);
    }
  }, [isVisible]);

  return (
    <div ref={ref} className={cn(className)}>
      {activated ? children(isVisible) : placeholder}
    </div>
  );
}
