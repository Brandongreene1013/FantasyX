"use client";

import { useEffect, useRef, useState } from "react";

type FlashDir = "up" | "down" | null;

export function PriceFlash({
  value,
  children,
  className = ""
}: {
  value: number;
  children: React.ReactNode;
  className?: string;
}) {
  const prevRef  = useRef(value);
  const [flash, setFlash] = useState<FlashDir>(null);

  useEffect(() => {
    if (prevRef.current === value) return;
    const dir: FlashDir = value > prevRef.current ? "up" : "down";
    prevRef.current = value;
    setFlash(dir);
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [value]);

  const flashClass =
    flash === "up"   ? "animate-flash-up" :
    flash === "down" ? "animate-flash-down" : "";

  return (
    <span className={`${className} ${flashClass} rounded transition-colors`}>
      {children}
    </span>
  );
}
