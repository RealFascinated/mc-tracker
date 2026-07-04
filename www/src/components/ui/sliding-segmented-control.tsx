import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ComponentProps, ReactNode, Ref } from "react";

import {
  slidingSegmentedControlIndicatorClassName,
  slidingSegmentedControlTrackClassName,
} from "@/components/ui/sliding-segmented-control-styles";
import { cn } from "cnfast";

type SlidingSegmentedControlContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  registerItem: (value: string, node: HTMLElement | null) => void;
};

const SlidingSegmentedControlContext =
  createContext<SlidingSegmentedControlContextValue | null>(null);

function useSlidingSegmentedControlContext() {
  const context = use(SlidingSegmentedControlContext);
  if (!context) {
    throw new Error(
      "SlidingSegmentedControlItem must be used within SlidingSegmentedControl",
    );
  }

  return context;
}

type SlidingSegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  indicatorClassName?: string;
  "aria-label": string;
};

function SlidingSegmentedControl({
  value,
  onValueChange,
  children,
  className,
  indicatorClassName,
  "aria-label": ariaLabel,
}: SlidingSegmentedControlProps) {
  const containerRef = useRef<HTMLFieldSetElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement> | null>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const hasMeasuredRef = useRef(false);
  const indicatorReadyRef = useRef(false);

  const getItemRefs = useCallback(() => {
    if (!itemRefs.current) {
      itemRefs.current = new Map();
    }
    return itemRefs.current;
  }, []);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const item = getItemRefs().get(value);
    const indicator = indicatorRef.current;
    if (!container || !indicator) {
      return;
    }

    if (!item) {
      indicator.style.opacity = "0";
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    indicator.style.left = `${itemRect.left - containerRect.left}px`;
    indicator.style.width = `${itemRect.width}px`;
    indicator.style.opacity = itemRect.width > 0 ? "1" : "0";

    if (!indicatorReadyRef.current && itemRect.width > 0) {
      indicatorReadyRef.current = true;
      indicator.style.transition =
        "left 200ms ease-out, width 200ms ease-out, opacity 150ms ease-out";
    }
  }, [getItemRefs, value]);

  const registerItem = useCallback(
    (itemValue: string, node: HTMLElement | null) => {
      const refs = getItemRefs();
      if (node) {
        refs.set(itemValue, node);
      } else {
        refs.delete(itemValue);
      }
    },
    [getItemRefs],
  );

  const contextValue = useMemo(
    () => ({ value, onValueChange, registerItem }),
    [onValueChange, registerItem, value],
  );

  useLayoutEffect(() => {
    if (hasMeasuredRef.current) {
      return;
    }
    updateIndicator();
    hasMeasuredRef.current = true;
  }, [updateIndicator]);

  useEffect(() => {
    if (!hasMeasuredRef.current) {
      return;
    }
    updateIndicator();
  }, [updateIndicator]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateIndicator();
    });

    observer.observe(container);
    for (const item of getItemRefs().values()) {
      observer.observe(item);
    }

    return () => observer.disconnect();
  }, [getItemRefs, updateIndicator]);

  return (
    <SlidingSegmentedControlContext.Provider value={contextValue}>
      <fieldset
        ref={containerRef}
        aria-label={ariaLabel}
        className={cn(
          slidingSegmentedControlTrackClassName,
          "m-0 min-w-0 border-0 p-0",
          className,
        )}
      >
        <div
          ref={indicatorRef}
          aria-hidden
          className={cn(
            slidingSegmentedControlIndicatorClassName,
            indicatorClassName,
          )}
        />
        {children}
      </fieldset>
    </SlidingSegmentedControlContext.Provider>
  );
}

type SlidingSegmentedControlItemProps = {
  value: string;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ComponentProps<"button">, "value" | "children" | "type" | "ref">;

function SlidingSegmentedControlItem({
  value: itemValue,
  children,
  className,
  onClick,
  ref,
  ...props
}: SlidingSegmentedControlItemProps) {
  const { value, onValueChange, registerItem } =
    useSlidingSegmentedControlContext();
  const selected = value === itemValue;

  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      registerItem(itemValue, node);

      if (typeof ref === "function") {
        ref(node);
        return;
      }

      if (ref) {
        ref.current = node;
      }
    },
    [itemValue, registerItem, ref],
  );

  return (
    <button
      ref={setRef}
      type="button"
      aria-pressed={selected}
      onClick={(event) => {
        onValueChange(itemValue);
        onClick?.(event);
      }}
      className={cn("relative z-10", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export { SlidingSegmentedControl, SlidingSegmentedControlItem };
