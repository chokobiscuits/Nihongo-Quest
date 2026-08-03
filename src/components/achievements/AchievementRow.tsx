import { InsetPanel } from "@/components/panel/Panel";
import type { AchievementRow as AchievementRowData } from "@/server/queries/achievements";
import type { AchievementAccent } from "@/services/achievements/definitions";

const ACCENT_TOKEN: Record<AchievementAccent, string> = {
  bronze: "var(--color-rank-bronze)",
  silver: "var(--color-rank-silver)",
  gold: "var(--color-rank-gold)",
  platinum: "var(--color-rank-platinum)",
  diamond: "var(--color-rank-diamond)",
  brand: "var(--color-brand)",
};

export interface AchievementRowProps {
  row: AchievementRowData;
}

/// §17 achievement row: medal icon, Japanese title, English requirement, and
/// a real progress bar/counter. Locked rows stay named and grey rather than
/// hidden — the whole list is a roadmap.
export function AchievementRow({ row }: AchievementRowProps) {
  const { definition, progress, target, unlocked } = row;
  const color = ACCENT_TOKEN[definition.accent];
  const displayTarget = Number.isFinite(target) ? target.toLocaleString() : "∞";
  const clampedProgress = Math.min(progress, target);
  const pct = target > 0 ? Math.min(100, Math.round((clampedProgress / target) * 100)) : 0;

  return (
    <InsetPanel className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-h2"
        style={{
          background: unlocked ? `color-mix(in oklch, ${color} 28%, transparent)` : "var(--color-surface-3)",
          color: unlocked ? color : "var(--color-text-faint)",
          opacity: unlocked ? 1 : 0.6,
        }}
      >
        🏅
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span lang="ja" className="truncate text-sub font-medium text-text">
            {definition.titleJa}
          </span>
          <span className="shrink-0 text-caption font-medium text-text-dim" lang="en">
            {clampedProgress.toLocaleString()}/{displayTarget}
          </span>
        </div>
        <span className="truncate text-caption text-text-faint" lang="en">
          {definition.titleEn}
        </span>
        {!unlocked && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        )}
      </div>
    </InsetPanel>
  );
}
