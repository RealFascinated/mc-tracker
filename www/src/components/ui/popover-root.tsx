import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export { Popover };
