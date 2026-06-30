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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element, rootMargin, threshold]);

  return { ref: setElement, isVisible };
}
