import { cn } from "@/lib/utils";

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
}

/// Multi-segment donut, e.g. SRS stage breakdown. Segments are drawn as
/// stacked stroke-dasharray arcs around a shared circle.
export function ProgressRing({
  segments,
  total,
  size = 120,
  strokeWidth = 12,
  centerLabel,
  centerSubLabel,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  const denominator = total ?? sum;

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
            const fraction = segment.value / denominator;
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
              />
            );
          })}
      </svg>
      {(centerLabel || centerSubLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && <span className="text-h2 font-semibold text-text">{centerLabel}</span>}
          {centerSubLabel && <span className="text-caption text-text-dim">{centerSubLabel}</span>}
        </div>
      )}
    </div>
  );
}
