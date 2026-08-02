import { InsetPanel } from "@/components/panel/Panel";
import { RankBadge } from "@/components/rank/RankBadge";
import type { Rank } from "@/services/xp/rank";
import type { MasteryTier } from "@/services/xp/mastery";
import { cn } from "@/lib/utils";

export interface DashboardHeaderProps {
  displayName: string;
  accountLevel: number;
  currentStreak: number;
  masteryTier: MasteryTier;
  rank: Rank;
  xpIntoCurrentLevel: number;
  xpForCurrentLevel: number;
}

/// §3 User header / profile bar: avatar, greeting, and three right-aligned
/// stat blocks (streak, mastery, level+XP bar). `はじめまして` at level 1
/// reads as a first-time greeting; `おかえりなさい` once the user has
/// actually made progress.
export function DashboardHeader({
  displayName,
  accountLevel,
  currentStreak,
  masteryTier,
  rank,
  xpIntoCurrentLevel,
  xpForCurrentLevel,
}: DashboardHeaderProps) {
  const isNewAccount = accountLevel <= 1 && xpIntoCurrentLevel === 0;
  const isMasteryUnstarted = masteryTier.level === 0;
  const greeting = isNewAccount ? `はじめまして、${displayName}!` : `おかえりなさい、${displayName}!`;
  const levelFraction = xpForCurrentLevel > 0 ? Math.min(1, xpIntoCurrentLevel / xpForCurrentLevel) : 0;

  return (
    <div
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        background:
          "linear-gradient(120deg, color-mix(in oklch, var(--color-brand) 12%, var(--color-surface)), var(--color-surface))",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-14 w-14 shrink-0 rounded-full border-2 border-line-strong bg-surface-3 bg-cover bg-center"
          aria-hidden
        />
        <div className="flex flex-col gap-0.5">
          <span lang="ja" className="text-h2 font-semibold text-text">
            {greeting}
          </span>
          <span lang="ja" className="text-sub text-text-dim">
            今日も一緒に日本語を極めよう！🌸
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <InsetPanel className="flex items-center gap-2 border-warn/30 px-3 py-2">
          <span aria-hidden className="text-h3 text-warn">
            🔥
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-h3 font-semibold text-text">{currentStreak}</span>
            <span className="text-micro text-text-faint" lang="en">
              Day Streak
            </span>
          </div>
        </InsetPanel>

        <InsetPanel className="flex items-center gap-2 px-3 py-2">
          <span
            aria-hidden
            className="text-h3"
            style={{ color: isMasteryUnstarted ? "var(--color-text-faint)" : `var(${masteryTier.colorToken})` }}
          >
            👑
          </span>
          <div className="flex flex-col leading-tight">
            <span
              className={cn(
                "text-h3 font-semibold",
                isMasteryUnstarted ? "text-text-faint" : "text-text",
              )}
              lang="en"
            >
              Lv.{masteryTier.level}
              {!isMasteryUnstarted && ` ${masteryTier.name}`}
            </span>
            <span className="text-micro text-text-faint" lang="en">
              {isMasteryUnstarted ? "Not started" : "Mastery"}
            </span>
          </div>
        </InsetPanel>

        <InsetPanel className="flex min-w-[180px] flex-col gap-1.5 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold text-text" lang="en">
              Level {accountLevel}
            </span>
            <RankBadge tier={rank.tier} division={rank.division} size="xs" />
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand to-[var(--color-brand-hover)]"
              style={{ width: `${Math.max(levelFraction * 100, isNewAccount ? 0 : 2)}%` }}
            />
          </div>
          <span className="text-micro text-text-faint" lang="en">
            {xpIntoCurrentLevel.toLocaleString()} / {xpForCurrentLevel.toLocaleString()} XP
          </span>
        </InsetPanel>
      </div>
    </div>
  );
}
