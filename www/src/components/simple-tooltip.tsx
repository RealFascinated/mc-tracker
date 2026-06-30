import type { ReactElement, ReactNode } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type SimpleTooltipProps = {
  content: ReactNode
  children: ReactElement
  side?: "top" | "right" | "bottom" | "left"
  className?: string
}

function SimpleTooltip({
  content,
  children,
  side = "top",
  className,
}: SimpleTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export { SimpleTooltip }
