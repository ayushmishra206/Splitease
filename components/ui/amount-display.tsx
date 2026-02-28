import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

interface AmountDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  showSign?: boolean;
}

export function AmountDisplay({
  amount,
  currency = "USD",
  className,
  showSign = false,
}: AmountDisplayProps) {
  const isPositive = amount > 0;
  const isNegative = amount < 0;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        isPositive && "text-emerald-600 dark:text-emerald-400",
        isNegative && "text-red-600 dark:text-red-400",
        !isPositive && !isNegative && "text-muted-foreground",
        className
      )}
    >
      {showSign && isPositive && "+"}
      {formatCurrency(Math.abs(amount), currency)}
    </span>
  );
}
