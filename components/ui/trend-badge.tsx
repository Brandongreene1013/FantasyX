import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendBadgeProps {
  value: number;
  label?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function TrendBadge({ value, label, showIcon = true, size = "sm" }: TrendBadgeProps) {
  const isPositive = value > 0;
  const isZero = value === 0;
  const display = label ?? `${isPositive ? "+" : ""}${value.toFixed(1)}%`;

  const classes = isZero
    ? "text-muted bg-rim border-rim"
    : isPositive
    ? "text-neon bg-neon/10 border-neon/20"
    : "text-crimson bg-crimson/10 border-crimson/20";

  const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold ${size === "md" ? "text-sm" : "text-xs"} ${classes}`}>
      {showIcon && <Icon className="h-3 w-3" aria-hidden />}
      {display}
    </span>
  );
}
