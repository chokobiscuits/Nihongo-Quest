"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

export interface DayStreakCardProps {
  currentStreak: number;
  days: { date: Date; active: boolean; isToday: boolean }[];
  className?: string;
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("ja-JP", { day: "numeric" });

/// §4 Day Streak widget: flame + count, then a row of five day-flames with
/// date numbers. Empty state (streak 0): "今日から始めよう" and hollow
/// flames for the upcoming window, with today's slot dashed.
export function DayStreakCard({ currentStreak, days, className }: DayStreakCardProps) {
  const hasStreak = currentStreak > 0;
  const displayedStreak = useCountUp(currentStreak);

  return (
    <Panel
      accent="var(--color-warn)"
      icon={<span aria-hidden>🔥</span>}
      title="Daily Streak"
      titleJa="連続記録"
      className={className}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-glyph-sm font-semibold tabular-nums text-text">{displayedStreak}</span>
          <span lang="ja" className="text-sub text-text-dim">
            {hasStreak ? `${currentStreak} 日連続！` : "今日から始めよう"}
          </span>
        </div>

        <InsetPanel className="flex items-center justify-between gap-1.5 px-2">
          {days.map((day, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sub",
                  day.active
                    ? "bg-brand-bg text-warn"
                    : day.isToday
                      ? "border border-dashed border-line-strong text-text-faint opacity-50"
                      : "border border-line text-text-faint opacity-40",
                )}
              >
                🔥
              </span>
              <span className="text-micro text-text-faint" lang="ja">
                {WEEKDAY_FORMAT.format(day.date)}
              </span>
            </div>
          ))}
        </InsetPanel>
      </div>
    </Panel>
  );
}
