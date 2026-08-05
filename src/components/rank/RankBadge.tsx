import type { Rank, RankTier } from "@/services/rank/tiers";
import { cn } from "@/lib/utils";

export type RankBadgeSize = "xs" | "sm" | "md" | "lg" | "hero";

export interface RankBadgeProps {
  tier: RankTier;
  division: number | null;
  size?: RankBadgeSize;
  showLabel?: boolean;
  className?: string;
}

const TIER_LABEL: Record<RankTier, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
};

// Roman numeral for divisions 1 (highest) through 4 (lowest), matching the
// `Rank.division` convention in src/services/xp/rank.ts.
const DIVISION_NUMERAL: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

const SIZE_CLASSES: Record<RankBadgeSize, string> = {
  xs: "h-5 px-2 text-micro gap-1",
  sm: "h-6 px-2.5 text-caption gap-1",
  md: "h-8 px-3 text-sub gap-1.5",
  lg: "h-10 px-4 text-h3 gap-2",
  hero: "h-14 px-6 text-h1 gap-3",
};

/// Renders a rank tier as a pill. Colors come from the `--color-rank-*`
/// tokens; Challenger uses the animated `.rank-challenger` gradient class
/// instead of a flat background. Master and above never show a division,
/// matching `RankBand.hasDivisions` in the rank service.
export function RankBadge({ tier, division, size = "md", showLabel = true, className }: RankBadgeProps) {
  const isChallenger = tier === "CHALLENGER";
  const tierKey = tier.toLowerCase();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-chip)] font-medium border border-line-strong",
        SIZE_CLASSES[size],
        isChallenger && "rank-challenger border-transparent",
        className,
      )}
      style={
        isChallenger
          ? undefined
          : {
              backgroundColor: `color-mix(in oklch, var(--color-rank-${tierKey}) 18%, transparent)`,
              color: `var(--color-rank-${tierKey}-text)`,
            }
      }
      data-tier={tier}
    >
      {showLabel && <span lang="en">{TIER_LABEL[tier]}</span>}
      {division !== null && <span lang="en">{DIVISION_NUMERAL[division]}</span>}
    </span>
  );
}

/// Convenience wrapper accepting the `Rank` shape from the xp/rank service
/// directly, so callers don't have to destructure it themselves.
export function RankBadgeFromRank({
  rank,
  ...rest
}: Omit<RankBadgeProps, "tier" | "division"> & { rank: Rank }) {
  return <RankBadge tier={rank.tier} division={rank.division} {...rest} />;
}
