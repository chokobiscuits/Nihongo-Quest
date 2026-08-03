"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import { RankCrest } from "@/components/rank/RankCrest";
import { RankBadge } from "@/components/rank/RankBadge";
import { MasteryBadge } from "@/components/rank/MasteryBadge";
import type { ProgressData } from "@/server/queries/progress";
import { useMountedFraction } from "@/hooks/useMountedFraction";

export interface AccountSummaryCardProps {
  account: ProgressData["account"];
  className?: string;
}

/// Account section: total XP, level + progress-to-next, rank crest/tier, and
/// account mastery tier — the single place all four account-scoped numbers
/// live together on the progress page.
export function AccountSummaryCard({ account, className }: AccountSummaryCardProps) {
  const levelFraction = account.xpForCurrentLevel > 0 ? account.xpIntoCurrentLevel / account.xpForCurrentLevel : 0;
  const sweptLevel = useMountedFraction(levelFraction, 100);
  const masteryFraction = account.masteryXpForNextLevel > 0 ? account.masteryXpIntoLevel / account.masteryXpForNextLevel : 0;
  const sweptMastery = useMountedFraction(masteryFraction, 180);

  return (
    <Panel accent={`var(--color-rank-${account.rank.tier.toLowerCase()})`} title="Account" titleJa="アカウント" className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <RankCrest tier={account.rank.tier} division={account.rank.division} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <RankBadge tier={account.rank.tier} division={account.rank.division} size="sm" />
            <span className="text-h2 font-semibold text-text" lang="en">
              Level {account.accountLevel}
            </span>
            <span className="text-caption text-text-faint" lang="en">
              {account.totalXp.toLocaleString()} total XP
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-text-dim" lang="en">
              Progress to Level {account.accountLevel + 1}
            </span>
            <span className="text-caption font-medium text-text" lang="en">
              {account.xpIntoCurrentLevel.toLocaleString()} / {account.xpForCurrentLevel.toLocaleString()} XP
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="progress-sweep h-full rounded-full bg-linear-to-r from-brand to-[var(--color-brand-hover)]"
              style={{ width: `${Math.max(sweptLevel * 100, sweptLevel > 0 ? 0 : 1.5)}%` }}
            />
          </div>
        </div>

        <InsetPanel className="flex items-center justify-between gap-3">
          <MasteryBadge tier={{ name: account.masteryTier.name, level: account.masteryTier.level, colorToken: account.masteryTier.colorToken }} size="md" />
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-caption text-text-dim" lang="en">
              Account Mastery — {account.accountMasteryXp.toLocaleString()} XP
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]"
                style={{ width: `${Math.max(sweptMastery * 100, 2)}%`, background: `var(${account.masteryTier.colorToken})` }}
              />
            </div>
          </div>
        </InsetPanel>
      </div>
    </Panel>
  );
}
