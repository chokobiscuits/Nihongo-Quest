import { Panel, InsetPanel } from "@/components/panel/Panel";
import type { LevelProgress } from "@/server/queries/progress";

export interface LevelProgressCardProps {
  level: LevelProgress;
  className?: string;
}

const ADVANCE_THRESHOLD_PCT = 90;

/// Current curriculum level, how many of that level's kanji are Guru+, and
/// what remains to advance — the rule is 90% of the level's kanji at Guru+
/// (src/services/srs/unlock.ts's nextUserLevel).
export function LevelProgressCard({ level, className }: LevelProgressCardProps) {
  const remaining = Math.max(
    Math.ceil(level.levelKanjiTotal * (ADVANCE_THRESHOLD_PCT / 100)) - level.levelKanjiGuruOrAbove,
    0,
  );

  return (
    <Panel accent="var(--color-kanji)" title="Level Progress" titleJa="レベル進捗" className={className}>
      <div className="flex flex-col gap-3">
        <InsetPanel className="flex items-center justify-between">
          <span className="text-caption text-text-dim" lang="en">
            Current Level
          </span>
          <span className="text-h2 font-semibold tabular-nums text-text" lang="en">
            {level.currentLevel}
          </span>
        </InsetPanel>

        {level.levelKanjiTotal === 0 ? (
          <span className="text-caption text-text-faint" lang="en">
            No kanji seeded for this level yet.
          </span>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption text-text-muted" lang="en">
                  Kanji at Guru+
                </span>
                <span className="text-caption font-medium text-text" lang="en">
                  {level.levelKanjiGuruOrAbove} / {level.levelKanjiTotal} ({level.percentToAdvance}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-kanji transition-[width] duration-500 ease-[var(--ease-out)]"
                  style={{ width: `${Math.min(level.percentToAdvance, 100)}%` }}
                />
                <div className="relative -mt-2 h-2 w-full" aria-hidden>
                  <div
                    className="absolute top-0 h-2 w-0.5 bg-text-faint"
                    style={{ left: `${ADVANCE_THRESHOLD_PCT}%` }}
                  />
                </div>
              </div>
            </div>
            <span className="text-caption text-text-dim" lang="en">
              {level.percentToAdvance >= ADVANCE_THRESHOLD_PCT
                ? "Threshold reached — the next lesson batch will advance your level."
                : `${remaining} more kanji at Guru+ to reach the ${ADVANCE_THRESHOLD_PCT}% threshold for level ${level.currentLevel + 1}.`}
            </span>
          </>
        )}
      </div>
    </Panel>
  );
}
