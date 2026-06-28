interface StatPillProps {
  label: string;
  value: string | number;
  tone?: "default" | "positive" | "negative" | "neutral" | "neon";
  size?: "sm" | "md";
}

const TONE_CLASSES = {
  default:  "bg-panel2 text-frost border-rim",
  positive: "bg-neon/10 text-neon border-neon/20",
  negative: "bg-crimson/10 text-crimson border-crimson/20",
  neutral:  "bg-rim text-muted border-rim",
  neon:     "bg-neon/15 text-neon border-neon/30"
};

export function StatPill({ label, value, tone = "default", size = "sm" }: StatPillProps) {
  return (
    <div className={`inline-flex flex-col items-center rounded-lg border px-2 py-1 ${TONE_CLASSES[tone]} ${size === "md" ? "px-3 py-2" : ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted leading-none">{label}</span>
      <span className={`font-black leading-tight ${size === "md" ? "text-sm mt-0.5" : "text-xs mt-0.5"}`}>{value}</span>
    </div>
  );
}
