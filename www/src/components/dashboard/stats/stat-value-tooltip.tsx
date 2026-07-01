import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "cnfast";

type StatValueTooltipProps = {
  tooltip?: string;
  value: string;
  className?: string;
};

export function StatValueTooltip({
  tooltip,
  value,
  className,
}: StatValueTooltipProps) {
  const valueClassName = cn(className);

  if (!tooltip) {
    return <span className={valueClassName}>{value}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(valueClassName, "cursor-help")}>{value}</span>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
