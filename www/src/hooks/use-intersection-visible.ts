import { useEffect, useState } from "react";

type UseIntersectionVisibleOptions = {
  rootMargin?: string;
  threshold?: number;
};

export function useIntersectionVisible({
  rootMargin = "80px 0px",
  threshold = 0,
}: UseIntersectionVisibleOptions = {}) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const intersecting = entry.isIntersecting;
        setIsIntersecting((prev) => (prev === intersecting ? prev : intersecting));
        if (intersecting) {
          setHasBeenVisible((prev) => prev || true);
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element, rootMargin, threshold]);

  return { ref: setElement, isIntersecting, hasBeenVisible };
}
