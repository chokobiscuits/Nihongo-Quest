import { Panel } from "@/components/panel/Panel";
import type { ActivityDay } from "@/server/queries/progress";
import { cn } from "@/lib/utils";

export interface ActivityHeatmapProps {
  days: ActivityDay[];
  className?: string;
}

const WEEKS_TO_SHOW = 26; // ~6 months

/// Four intensity buckets by xpEarned, matching a typical GitHub-style
/// calendar's 5-step scale (0 = no activity + 4 shaded steps).
function intensityClass(xpEarned: number): string {
  if (xpEarned <= 0) return "bg-surface-3";
  if (xpEarned < 25) return "bg-[color-mix(in_oklch,var(--color-brand)_25%,var(--color-surface-3))]";
  if (xpEarned < 75) return "bg-[color-mix(in_oklch,var(--color-brand)_50%,var(--color-surface-3))]";
  if (xpEarned < 150) return "bg-[color-mix(in_oklch,var(--color-brand)_75%,var(--color-surface-3))]";
  return "bg-brand";
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/// GitHub-style activity calendar built from real `DailyActivity` rows,
/// colored by `xpEarned`. With only a couple of real rows in a fresh account
/// this renders as a mostly-empty grid with a handful of lit cells near the
/// end — the sparse state is the honest state, not a bug, so no filler data
/// is synthesized to make it look busier.
export function ActivityHeatmap({ days, className }: ActivityHeatmapProps) {
  const byDay = new Map<string, ActivityDay>();
  for (const d of days) byDay.set(isoDay(d.date), d);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Align the grid end to the most recent Saturday so weeks are full columns.
  const endOfWeek = new Date(today);
  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + (6 - endOfWeek.getUTCDay()));
  const totalDays = WEEKS_TO_SHOW * 7;
  const start = new Date(endOfWeek);
  start.setUTCDate(start.getUTCDate() - totalDays + 1);

  const cells: { date: Date; activity: ActivityDay | null; future: boolean }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    cells.push({ date, activity: byDay.get(isoDay(date)) ?? null, future: date > today });
  }

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const activeDayCount = days.filter((d) => d.xpEarned > 0).length;

  return (
    <Panel accent="var(--color-brand)" title="Activity" titleJa="活動履歴" className={className}>
      <div className="flex flex-col gap-3">
        {activeDayCount === 0 ? (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <span className="text-sub font-medium text-text" lang="en">
              Just getting started
            </span>
            <span className="text-caption text-text-faint" lang="en">
              Complete a lesson or review to light up your first day.
            </span>
          </div>
        ) : (
          <span className="text-caption text-text-dim" lang="en">
            {activeDayCount} active day{activeDayCount === 1 ? "" : "s"} in the last {WEEKS_TO_SHOW} weeks
          </span>
        )}

        <div className="flex gap-1 overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((cell, di) => (
                <div
                  key={di}
                  title={
                    cell.future
                      ? undefined
                      : `${isoDay(cell.date)}: ${cell.activity?.xpEarned ?? 0} XP${
                          cell.activity ? ` · ${cell.activity.reviewCount} reviews, ${cell.activity.lessonCount} lessons` : ""
                        }`
                  }
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-[3px]",
                    cell.future ? "bg-transparent" : intensityClass(cell.activity?.xpEarned ?? 0),
                  )}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-1.5 text-micro text-text-faint" lang="en">
          <span>Less</span>
          <span className="h-2.5 w-2.5 rounded-[3px] bg-surface-3" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[color-mix(in_oklch,var(--color-brand)_25%,var(--color-surface-3))]" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[color-mix(in_oklch,var(--color-brand)_50%,var(--color-surface-3))]" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[color-mix(in_oklch,var(--color-brand)_75%,var(--color-surface-3))]" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-brand" />
          <span>More</span>
        </div>
      </div>
    </Panel>
  );
}
