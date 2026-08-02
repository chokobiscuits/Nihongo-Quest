"use client";

import { cn } from "@/lib/utils";
import { useMountedFraction } from "@/hooks/useMountedFraction";

export interface ProgressRingSegment {
  value: number;
  color: string;
  label?: string;
}

export interface ProgressRingProps {
  segments: ProgressRingSegment[];
  /// Total the segments are measured against. Defaults to the sum of segment
  /// values (a fully-filled ring); pass explicitly to leave a remainder gap.
  total?: number;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  className?: string;
  /// Stagger delay (ms) before the ring sweeps from empty to its value —
  /// lets a page stagger multiple rings/bars 80ms apart.
  sweepDelayMs?: number;
}

/// Multi-segment donut, e.g. SRS stage breakdown. Segments are drawn as
/// stacked stroke-dasharray arcs around a shared circle. Sweeps from an
/// empty track to the real value on mount via `useMountedFraction`.
export function ProgressRing({
  segments,
  total,
  size = 120,
  strokeWidth = 12,
  centerLabel,
  centerSubLabel,
  className,
  sweepDelayMs = 0,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  const denominator = total ?? sum;
  const sweep = useMountedFraction(1, sweepDelayMs);

  let offsetAccum = 0;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={strokeWidth}
        />
        {denominator > 0 &&
          segments.map((segment, index) => {
            if (segment.value <= 0) return null;
            const fraction = (segment.value / denominator) * sweep;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const dashoffset = -offsetAccum * circumference;
            offsetAccum += fraction;
            return (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={dashoffset}
                strokeLinecap="butt"
                className="progress-sweep-ring"
              />
            );
          })}
      </svg>
      {(centerLabel || centerSubLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && <span className="text-h2 font-semibold tabular-nums text-text">{centerLabel}</span>}
          {centerSubLabel && <span className="text-caption text-text-dim">{centerSubLabel}</span>}
        </div>
      )}
    </div>
  );
}
