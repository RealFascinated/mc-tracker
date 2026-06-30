import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("monitor-input", type === "password" && "pr-10", className)}
      {...props}
    />
  )
}

export { Input }
