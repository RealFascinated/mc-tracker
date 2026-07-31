import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "cnfast";

export type SegmentedControlOption<T extends string> = {
  value: T;
  shortLabel: string;
  /** Accessible name and tooltip; defaults to `shortLabel`. */
  label?: string;
  /** Visible text on small screens instead of `shortLabel`. */
  mobileLabel?: string;
  /** Hide the label on small screens (icon-only). */
  hideLabelOnMobile?: boolean;
  /** Leading icon. */
  icon?: LucideIcon;
  /** Icon shown when the option is selected, overriding `icon`. */
  activeIcon?: LucideIcon;
  /** Overrides `label` for the accessible name. */
  ariaLabel?: string;
};

export type SegmentedControlRenderItemProps<T extends string> = {
  option: SegmentedControlOption<T>;
  selected: boolean;
  className: string;
  ref: (node: HTMLElement | null) => void;
  onClick: () => void;
  "aria-label": string;
  children: ReactNode;
};

type SegmentedControlContextValue<T extends string> = {
  value: T;
  registerItem: (value: T, node: HTMLElement | null) => void;
};

const SegmentedControlContext =
  createContext<SegmentedControlContextValue<string> | null>(null);

function useSegmentedControlContext<T extends string>() {
  const context = use(SegmentedControlContext);
  if (!context) {
    throw new Error(
      "SegmentedControl items must be rendered within SegmentedControl",
    );
  }
  return context as unknown as SegmentedControlContextValue<T>;
}

const segmentedControlTrackClassName =
  "relative inline-flex w-fit max-w-full rounded-snug bg-muted p-0.5";

const segmentedControlIndicatorClassName =
  "pointer-events-none absolute top-0.5 bottom-0.5 rounded-snug bg-white shadow-sm ring-1 ring-black/5 dark:bg-monitor-gray-400 dark:ring-white/10";

const segmentedControlItemBaseClassName =
  "relative z-10 inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-snug px-2.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monitor dark:focus-visible:ring-warning max-sm:px-1.5 max-sm:text-[11px]";

const segmentedControlItemSelectedClassName =
  "font-semibold text-monitor dark:text-warning";

const segmentedControlItemIdleClassName =
  "text-muted-foreground hover:text-foreground";

function renderOptionContent<T extends string>(
  option: SegmentedControlOption<T>,
  selected: boolean,
) {
  const Icon = selected && option.activeIcon ? option.activeIcon : option.icon;

  let label: ReactNode = <span>{option.shortLabel}</span>;
  if (option.hideLabelOnMobile) {
    label = <span className="max-sm:hidden">{option.shortLabel}</span>;
  } else if (option.mobileLabel) {
    label = (
      <>
        <span className="max-sm:hidden">{option.shortLabel}</span>
        <span className="sm:hidden" aria-hidden>
          {option.mobileLabel}
        </span>
      </>
    );
  }

  return (
    <>
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {label}
    </>
  );
}

type SegmentedControlProps<T extends string> = {
  value: T;
  options: ReadonlyArray<SegmentedControlOption<T>>;
  onValueChange?: (value: T) => void;
  "aria-label": string;
  className?: string;
  /** Custom item renderer, e.g. router links that navigate instead of calling `onValueChange`. */
  renderItem?: (props: SegmentedControlRenderItemProps<T>) => ReactNode;
};

function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  "aria-label": ariaLabel,
  className,
  renderItem,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  const contextValue = useMemo<SegmentedControlContextValue<string>>(
    () => ({ value, registerItem }),
    [registerItem, value],
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
    <SegmentedControlContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        role="group"
        aria-label={ariaLabel}
        className={cn(segmentedControlTrackClassName, className)}
      >
        <div
          ref={indicatorRef}
          aria-hidden
          className={segmentedControlIndicatorClassName}
        />
        {options.map((option) => (
          <SegmentedControlItem
            key={option.value}
            option={option}
            selected={value === option.value}
            onSelect={() => onValueChange?.(option.value)}
            renderItem={renderItem}
          />
        ))}
      </div>
    </SegmentedControlContext.Provider>
  );
}

function SegmentedControlItem<T extends string>({
  option,
  selected,
  onSelect,
  renderItem,
}: {
  option: SegmentedControlOption<T>;
  selected: boolean;
  onSelect: () => void;
  renderItem?: SegmentedControlProps<T>["renderItem"];
}) {
  const { registerItem } = useSegmentedControlContext<T>();

  const setRef = useCallback(
    (node: HTMLElement | null) => registerItem(option.value, node),
    [option.value, registerItem],
  );

  const ariaLabel = option.ariaLabel ?? option.label ?? option.shortLabel;
  const title =
    option.label && option.label !== option.shortLabel
      ? option.label
      : undefined;
  const className = cn(
    segmentedControlItemBaseClassName,
    selected
      ? segmentedControlItemSelectedClassName
      : segmentedControlItemIdleClassName,
  );
  const children = renderOptionContent(option, selected);

  if (renderItem) {
    return renderItem({
      option,
      selected,
      className,
      ref: setRef,
      onClick: onSelect,
      "aria-label": ariaLabel,
      children,
    });
  }

  return (
    <button
      type="button"
      ref={setRef}
      aria-pressed={selected}
      aria-label={ariaLabel}
      title={title}
      className={className}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

export { SegmentedControl };
export type { SegmentedControlProps };
