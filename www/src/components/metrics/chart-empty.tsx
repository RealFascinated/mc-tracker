import { cn } from "@/lib/utils";

type Props = {
  message: string;
  className?: string;
  minHeight?: number;
};

function ChartEmpty({ message, className, minHeight = 220 }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-xs text-muted-foreground",
        className,
      )}
      style={{ minHeight }}
    >
      {message}
    </div>
  );
}

export { ChartEmpty };
