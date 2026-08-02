import { Panel, InsetPanel } from "@/components/panel/Panel";
import type { DashboardAchievement } from "@/server/queries/dashboard";

export interface AchievementsCardProps {
  achievements: DashboardAchievement[];
  className?: string;
}

const MEDAL_COLORS = ["var(--color-rank-gold)", "var(--color-kanji)", "var(--color-vocab)", "var(--color-warn)", "var(--color-rank-diamond)"];

/// §17 Achievements list: rows with a colored medal icon, Japanese title,
/// and an English requirement. All greyed with real progress counters at
/// zero — nothing here is hidden just because it hasn't been earned yet.
export function AchievementsCard({ achievements, className }: AchievementsCardProps) {
  return (
    <Panel accent="var(--color-rank-gold)" title="Achievements" titleJa="実績" className={className}>
      <div className="flex flex-col gap-2">
        {achievements.map((achievement, index) => {
          const earned = achievement.progress >= achievement.target;
          const color = MEDAL_COLORS[index % MEDAL_COLORS.length];
          const displayTarget = Number.isFinite(achievement.target) ? achievement.target.toLocaleString() : "∞";
          const displayProgress = Math.min(achievement.progress, Number.isFinite(achievement.target) ? achievement.target : achievement.progress).toLocaleString();

          return (
            <InsetPanel key={achievement.id} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-h3"
                style={{
                  background: earned
                    ? `color-mix(in oklch, ${color} 28%, transparent)`
                    : "var(--color-surface-3)",
                  color: earned ? color : "var(--color-text-faint)",
                  opacity: earned ? 1 : 0.6,
                }}
              >
                🏅
              </span>
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span lang="ja" className="truncate text-sub font-medium text-text">
                  {achievement.titleJa}
                </span>
                <span className="truncate text-caption text-text-faint" lang="en">
                  {achievement.requirementEn}
                </span>
              </div>
              <span className="shrink-0 text-caption font-medium text-text-dim" lang="en">
                {displayProgress}/{displayTarget}
              </span>
            </InsetPanel>
          );
        })}
      </div>
    </Panel>
  );
}
