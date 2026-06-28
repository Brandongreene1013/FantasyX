import { pct } from "@/lib/format";

interface PriceBadgeProps {
  side: "YES" | "NO";
  price: number;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
}

const SIZE_CLASSES = {
  sm: "px-2 py-1 text-xs gap-1",
  md: "px-3 py-1.5 text-sm gap-1.5",
  lg: "px-4 py-2 text-base gap-2"
};

export function PriceBadge({ side, price, size = "md", onClick, disabled }: PriceBadgeProps) {
  const isYes = side === "YES";
  const base = `inline-flex items-center rounded-lg font-black border transition-all ${SIZE_CLASSES[size]}`;
  const yesStyle = "bg-neon/10 text-neon border-neon/30 hover:bg-neon/20 hover:border-neon/50";
  const noStyle  = "bg-crimson/10 text-crimson border-crimson/30 hover:bg-crimson/20 hover:border-crimson/50";
  const disabledStyle = "opacity-40 cursor-not-allowed";

  if (onClick) {
    return (
      <button
        className={`${base} ${isYes ? yesStyle : noStyle} ${disabled ? disabledStyle : ""}`}
        onClick={onClick}
        disabled={disabled}
        type="button"
        aria-label={`${side} at ${pct(price)}`}
      >
        <span className="text-[10px] font-black opacity-70">{side}</span>
        <span>{pct(price)}</span>
      </button>
    );
  }

  return (
    <div className={`${base} ${isYes ? yesStyle : noStyle}`}>
      <span className="text-[10px] font-black opacity-70">{side}</span>
      <span>{pct(price)}</span>
    </div>
  );
}
