import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export { PopoverTrigger };
