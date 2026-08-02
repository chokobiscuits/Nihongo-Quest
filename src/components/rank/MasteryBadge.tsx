import type { MasteryTier } from "@/services/xp/mastery";
import { cn } from "@/lib/utils";

export type MasteryBadgeSize = "sm" | "md" | "lg";

export interface MasteryBadgeProps {
  tier: MasteryTier;
  size?: MasteryBadgeSize;
  className?: string;
}

// §19 mastery ring badges: a numbered ring, colored per tier, with the tier
// name underneath. Sizes mirror RankBadge's scale but stay a fixed circle
// rather than a pill, matching the sheet's ring-badge shape.
const RING_SIZE_CLASSES: Record<MasteryBadgeSize, string> = {
  sm: "h-8 w-8 text-sub border-2",
  md: "h-11 w-11 text-h3 border-[3px]",
  lg: "h-16 w-16 text-h1 border-4",
};

const LABEL_SIZE_CLASSES: Record<MasteryBadgeSize, string> = {
  sm: "text-micro",
  md: "text-caption",
  lg: "text-sub",
};

/// Renders a mastery level as a numbered ring badge (per Assets.png §19),
/// colored by tier, with the tier name beneath it. Level 0 ("Unranked")
/// renders muted rather than in a tier color.
export function MasteryBadge({ tier, size = "md", className }: MasteryBadgeProps) {
  const isUnranked = tier.level === 0;
  const color = `var(${tier.colorToken})`;

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold",
          RING_SIZE_CLASSES[size],
        )}
        style={{
          borderColor: isUnranked ? "var(--color-line-strong)" : color,
          color: isUnranked ? "var(--color-text-faint)" : color,
          background: isUnranked
            ? "var(--color-surface-3)"
            : `color-mix(in oklch, ${color} 16%, var(--color-surface))`,
        }}
        aria-hidden
      >
        {tier.level}
      </span>
      <span
        className={cn("font-medium", LABEL_SIZE_CLASSES[size], isUnranked ? "text-text-faint" : undefined)}
        style={isUnranked ? undefined : { color }}
        lang="en"
      >
        {tier.name}
      </span>
    </div>
  );
}
