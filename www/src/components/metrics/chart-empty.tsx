import { cn } from "@/lib/utils";

type Props = {
  message: string;
  className?: string;
  height?: number;
};

function ChartEmpty({ message, className, height = 220 }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-xs text-muted-foreground",
        className,
      )}
      style={{ height }}
    >
      {message}
    </div>
  );
}

export { ChartEmpty };
