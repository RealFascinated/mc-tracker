import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import type { ComponentProps, ReactNode, Ref } from "react"

import {
  slidingSegmentedControlIndicatorClassName,
  slidingSegmentedControlTrackClassName,
} from "@/components/ui/sliding-segmented-control-styles"
import { cn } from "@/lib/utils"

type SlidingSegmentedControlContextValue = {
  value: string
  onValueChange: (value: string) => void
  registerItem: (value: string, node: HTMLElement | null) => void
}

const SlidingSegmentedControlContext =
  createContext<SlidingSegmentedControlContextValue | null>(null)

function useSlidingSegmentedControlContext() {
  const context = useContext(SlidingSegmentedControlContext)
  if (!context) {
    throw new Error(
      "SlidingSegmentedControlItem must be used within SlidingSegmentedControl",
    )
  }

  return context
}

type SlidingSegmentedControlProps = {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
  indicatorClassName?: string
  "aria-label": string
}

function SlidingSegmentedControl({
  value,
  onValueChange,
  children,
  className,
  indicatorClassName,
  "aria-label": ariaLabel,
}: SlidingSegmentedControlProps) {
  const containerRef = useRef<HTMLFieldSetElement>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const hasMeasuredRef = useRef(false)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [indicatorReady, setIndicatorReady] = useState(false)

  const updateIndicator = useCallback(() => {
    const container = containerRef.current
    const item = itemRefs.current.get(value)
    if (!container || !item) return

    const containerRect = container.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    setIndicator({
      left: itemRect.left - containerRect.left,
      width: itemRect.width,
    })
    setIndicatorReady(true)
  }, [value])

  const registerItem = useCallback(
    (itemValue: string, node: HTMLElement | null) => {
      if (node) {
        itemRefs.current.set(itemValue, node)
      } else {
        itemRefs.current.delete(itemValue)
      }
    },
    [],
  )

  useLayoutEffect(() => {
    if (hasMeasuredRef.current) return
    updateIndicator()
    hasMeasuredRef.current = true
  }, [updateIndicator])

  useEffect(() => {
    if (!hasMeasuredRef.current) return
    updateIndicator()
  }, [updateIndicator])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      updateIndicator()
    })

    observer.observe(container)
    for (const item of itemRefs.current.values()) {
      observer.observe(item)
    }

    return () => observer.disconnect()
  }, [updateIndicator])

  return (
    <SlidingSegmentedControlContext.Provider
      value={{ value, onValueChange, registerItem }}
    >
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
          aria-hidden
          className={cn(
            slidingSegmentedControlIndicatorClassName,
            indicatorClassName,
          )}
          style={{
            left: indicator.left,
            width: indicator.width,
            opacity: indicator.width > 0 ? 1 : 0,
            transition: indicatorReady
              ? "left 200ms ease-out, width 200ms ease-out, opacity 150ms ease-out"
              : undefined,
          }}
        />
        {children}
      </fieldset>
    </SlidingSegmentedControlContext.Provider>
  )
}

type SlidingSegmentedControlItemProps = {
  value: string
  children: ReactNode
  ref?: Ref<HTMLButtonElement>
} & Omit<ComponentProps<"button">, "value" | "children" | "type" | "ref">

function SlidingSegmentedControlItem({
  value: itemValue,
  children,
  className,
  onClick,
  ref,
  ...props
}: SlidingSegmentedControlItemProps) {
  const { value, onValueChange, registerItem } =
    useSlidingSegmentedControlContext()
  const selected = value === itemValue

  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      registerItem(itemValue, node)

      if (typeof ref === "function") {
        ref(node)
        return
      }

      if (ref) {
        ref.current = node
      }
    },
    [itemValue, registerItem, ref],
  )

  return (
    <button
      ref={setRef}
      type="button"
      aria-pressed={selected}
      onClick={(event) => {
        onValueChange(itemValue)
        onClick?.(event)
      }}
      className={cn("relative z-10", className)}
      {...props}
    >
      {children}
    </button>
  )
}

export { SlidingSegmentedControl, SlidingSegmentedControlItem }
