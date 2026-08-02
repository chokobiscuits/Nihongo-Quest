"use client";

import { useCountUp } from "@/hooks/useCountUp";

export interface CelebrationNumeralProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/// Counts up to `value` over 900ms per the celebration choreography (t=300),
/// distinct from the dashboard's 700ms count-up. `tabular-nums` so the
/// numeral doesn't jitter in width as it ticks.
export function CelebrationNumeral({ value, prefix = "", suffix = "", className }: CelebrationNumeralProps) {
  const displayed = useCountUp(value, 900);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {displayed.toLocaleString()}
      {suffix}
    </span>
  );
}
