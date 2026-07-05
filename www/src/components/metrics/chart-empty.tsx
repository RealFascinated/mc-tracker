import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { cn } from "cnfast";

type Props = {
  message: string;
  className?: string;
  height?: number;
};

function ChartEmpty({ message, className, height = 220 }: Props) {
  return (
    <Empty className={cn("border-0 p-0", className)} style={{ height }}>
      <EmptyHeader>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export { ChartEmpty };
