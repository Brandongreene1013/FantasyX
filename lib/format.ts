export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function credits(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} cr`;
}

export function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function thresholdLabel(value: string) {
  return value.replace("TOP_", "Top ");
}
