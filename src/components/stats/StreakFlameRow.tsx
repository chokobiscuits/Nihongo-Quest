import { cn } from "@/lib/utils";

export interface StreakFlameRowProps {
  /// One entry per day in the window (typically 7), true = active day.
  days: boolean[];
  /// Bilingual day-of-week labels shown under each flame, aligned to `days`.
  dayLabels?: string[];
  currentStreak: number;
  className?: string;
}

/// Row of flame indicators for a streak window (e.g. last 7 days).
export function StreakFlameRow({ days, dayLabels, currentStreak, className }: StreakFlameRowProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1">
        {days.map((active, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <span
              aria-hidden
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-sub",
                active ? "bg-brand-bg text-warn" : "bg-surface-2 text-text-faint",
              )}
            >
              {active ? "🔥" : "・"}
            </span>
            {dayLabels?.[index] && (
              <span className="text-micro text-text-faint" lang="en">
                {dayLabels[index]}
              </span>
            )}
          </div>
        ))}
      </div>
      <span className="text-caption text-text-muted">
        <span lang="en">Streak</span>{" "}
        <span className="font-semibold text-text">{currentStreak}</span>
      </span>
    </div>
  );
}
