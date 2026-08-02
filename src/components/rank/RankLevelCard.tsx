"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import { RankCrest } from "@/components/rank/RankCrest";
import { RANK_BANDS, rankForLevel, type Rank, type RankTier } from "@/services/xp/rank";
import { totalXpToReach, xpForLevel } from "@/services/xp/curve";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useMountedFraction } from "@/hooks/useMountedFraction";

export interface RankLevelCardProps {
  accountLevel: number;
  totalXp: number;
  className?: string;
}

const TIER_ORDER: RankTier[] = RANK_BANDS.map((b) => b.tier);

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

const DIVISION_NUMERAL: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

// LP is a display convenience layered on top of the level/XP model: each
// account level is worth 25 LP, so "Next: Iron III (25 LP)" reads as one
// full level's climb, and progress within the current level scales linearly
// to a 0-25 LP bar.
const LP_PER_LEVEL = 25;

export function lpProgress(accountLevel: number, totalXp: number) {
  const xpAtLevelStart = totalXpToReach(accountLevel);
  const xpForThisLevel = xpForLevel(accountLevel);
  const xpIntoLevel = Math.max(0, totalXp - xpAtLevelStart);
  const fraction = xpForThisLevel > 0 ? Math.min(1, xpIntoLevel / xpForThisLevel) : 0;
  return Math.round(fraction * LP_PER_LEVEL);
}

/// Human label for the rank one step better than `rank`, e.g. Iron IV ->
/// Iron III, Iron I -> Bronze IV, Challenger -> null (open-ended, no "next").
function nextRankLabel(rank: Rank): string | null {
  const bandIndex = TIER_ORDER.indexOf(rank.tier);
  const band = RANK_BANDS[bandIndex];

  if (band.hasDivisions && rank.division !== null && rank.division > 1) {
    return `${TIER_LABEL[rank.tier]} ${DIVISION_NUMERAL[rank.division - 1]}`;
  }

  const nextBand = RANK_BANDS[bandIndex + 1];
  if (!nextBand) return null;
  return nextBand.hasDivisions ? `${TIER_LABEL[nextBand.tier]} IV` : TIER_LABEL[nextBand.tier];
}

/// The Rank & Level dashboard card: crest, tier/LP readout, progress bar,
/// and a nine-tier ladder showing where the current tier sits among all
/// nine. Rank, division, and LP are all derived from `xp/rank.ts` and
/// `xp/curve.ts` — nothing here is hardcoded per tier.
export function RankLevelCard({ accountLevel, totalXp, className }: RankLevelCardProps) {
  const rank = rankForLevel(accountLevel);
  const accentToken = `var(--color-rank-${rank.tier.toLowerCase()})`;
  const lp = lpProgress(accountLevel, totalXp);
  const lpFraction = lp / LP_PER_LEVEL;
  const sweptLpFraction = useMountedFraction(lpFraction, 160);
  const displayedLp = useCountUp(lp);
  const nextLabel = nextRankLabel(rank);
  const tierIndex = TIER_ORDER.indexOf(rank.tier);

  const tierLine = rank.division !== null
    ? `${TIER_LABEL[rank.tier]} ${DIVISION_NUMERAL[rank.division]}`
    : TIER_LABEL[rank.tier];

  return (
    <Panel
      accent={accentToken}
      title="Rank & Level"
      titleJa="ランク"
      icon={<span className="text-caption font-bold">R</span>}
      className={className}
    >
      <div className="flex flex-col items-center gap-3 pb-4">
        <RankCrest tier={rank.tier} division={rank.division} size="hero" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-h2 font-semibold text-text" lang="en">
            {tierLine}
            {rank.division !== null && <span className="text-h3 tabular-nums text-text-muted"> · {displayedLp} LP</span>}
          </span>
        </div>

        <div className="w-full max-w-[220px]">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="progress-sweep h-full rounded-full bg-linear-to-r from-brand to-[var(--color-brand-hover)]"
              style={{ width: `${Math.max(sweptLpFraction * 100, sweptLpFraction > 0 ? 0 : 1.5)}%` }}
            />
            {lp === 0 && (
              <div
                className="absolute inset-y-0 left-0 w-1 rounded-full"
                style={{ background: accentToken }}
                aria-hidden
              />
            )}
          </div>
        </div>

        <span className="text-caption text-text-dim" lang="en">
          {nextLabel ? `Next: ${nextLabel} (${LP_PER_LEVEL} LP)` : "Top rank reached"}
        </span>
      </div>

      <InsetPanel className="flex items-center justify-center gap-2.5">
        {TIER_ORDER.map((tier, index) => {
          const isCurrent = index === tierIndex;
          const isPast = index < tierIndex;
          const dotColor = `var(--color-rank-${tier.toLowerCase()})`;
          const filled = isCurrent || isPast;
          return (
            <span
              key={tier}
              title={TIER_LABEL[tier]}
              className={cn(
                "rounded-full transition-transform duration-[var(--duration-fast)]",
                isCurrent && "scale-125",
              )}
              style={{
                width: filled ? 10 : 6,
                height: filled ? 10 : 6,
                background: filled ? dotColor : "var(--color-surface-3)",
                opacity: isCurrent ? 1 : isPast ? 0.55 : 1,
              }}
            />
          );
        })}
      </InsetPanel>
    </Panel>
  );
}
