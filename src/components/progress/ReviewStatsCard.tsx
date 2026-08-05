"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import type { ReviewStats } from "@/services/reviews/stats";
import { useMountedFraction } from "@/hooks/useMountedFraction";
import { cn } from "@/lib/utils";

export interface ReviewStatsCardProps {
  stats: ReviewStats;
  className?: string;
}

const TYPE_LABELS: Record<string, string> = {
  MEANING: "Meaning",
  READING: "Reading",
};

const TYPE_COLORS: Record<string, string> = {
  MEANING: "var(--color-brand)",
  READING: "var(--color-kanji)",
};

/// Accuracy split by question type plus a daily trend line.
///
/// Scores ranked reviews only by default. Unranked practice has no due-date
/// filter and can be drilled without limit, so folding it in would let volume
/// on easy items mask real SRS performance -- the excluded count is shown
/// rather than hidden. See buildReviewStats.
export function ReviewStatsCard({ stats, className }: ReviewStatsCardProps) {
  const sweep = useMountedFraction(1, 200);
  const hasData = stats.totalAnswers > 0;
  const peak = Math.max(...stats.trend.map((p) => p.correct + p.incorrect), 1);

  return (
    <Panel
      accent="var(--color-brand)"
      title="Review Accuracy"
      titleJa="正答率"
      className={className}
    >
      <div className="flex flex-col gap-4">
        {!hasData ? (
          <InsetPanel className="py-6 text-center">
            <p className="text-body text-text-dim" lang="en">
              No reviews yet
            </p>
            <p className="mt-1 text-caption text-text-faint" lang="en">
              Accuracy appears once you have completed some ranked reviews.
            </p>
          </InsetPanel>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-h1 font-semibold tabular-nums text-text" lang="en">
                {stats.overallAccuracyPct}%
              </span>
              <span className="text-caption text-text-faint" lang="en">
                across {stats.totalAnswers.toLocaleString()} ranked answers
              </span>
            </div>

            {/* Meaning vs. reading: the split this card exists for. */}
            <div className="flex flex-col gap-2.5">
              {stats.split.map((entry) => {
                const total = entry.correct + entry.incorrect;
                return (
                  <div key={entry.questionType} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-2 text-caption text-text-muted" lang="en">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: TYPE_COLORS[entry.questionType] }}
                        />
                        {TYPE_LABELS[entry.questionType] ?? entry.questionType}
                      </span>
                      <span className="text-caption tabular-nums text-text-dim" lang="en">
                        {entry.accuracyPct}%
                        <span className="text-text-faint">
                          {" "}
                          ({entry.correct.toLocaleString()}/{total.toLocaleString()})
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-[var(--radius-chip)] bg-surface-3">
                      <div
                        className="h-full transition-[width] duration-500 ease-[var(--ease-out)]"
                        style={{
                          width: `${(entry.accuracyPct / 100) * sweep * 100}%`,
                          background: TYPE_COLORS[entry.questionType],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Daily volume, correct over incorrect. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-micro font-semibold uppercase tracking-[0.08em] text-text-dim" lang="en">
                Last {stats.trend.length} days
              </span>
              <div className="flex h-20 items-end gap-1" role="img" aria-label="Daily review accuracy trend">
                {stats.trend.map((point) => {
                  const dayTotal = point.correct + point.incorrect;
                  const height = (dayTotal / peak) * sweep;
                  const correctShare = dayTotal === 0 ? 0 : point.correct / dayTotal;
                  return (
                    <div
                      key={point.date.toISOString()}
                      className="flex h-full min-w-0 flex-1 flex-col justify-end"
                      title={`${point.date.toISOString().slice(0, 10)}: ${point.accuracyPct}% (${point.correct}/${dayTotal})`}
                    >
                      {/*
                        Rounding lives on this wrapper, with the two segments
                        square and clipped by overflow-hidden. Rounding the
                        segments themselves gives each one its own capsule
                        top, so the incorrect/correct boundary reads as two
                        separate pills rather than one stacked bar.
                      */}
                      <div
                        className="flex w-full flex-col justify-end overflow-hidden rounded-[3px] transition-[height] duration-500 ease-[var(--ease-out)]"
                        style={{ height: `max(2px, ${height * 100}%)` }}
                      >
                        <div
                          className="w-full shrink-0"
                          style={{
                            height: `${(1 - correctShare) * 100}%`,
                            background: "color-mix(in oklch, var(--color-danger) 70%, transparent)",
                          }}
                        />
                        <div
                          className="w-full shrink-0"
                          style={{ height: `${correctShare * 100}%`, background: "var(--color-brand)" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <InsetPanel className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-caption text-text-faint" lang="en">
                Ranked reviews only
              </span>
              <span
                className={cn("text-caption tabular-nums text-text-dim", stats.practiceAnswers === 0 && "opacity-60")}
                lang="en"
              >
                {stats.practiceAnswers.toLocaleString()} practice answer
                {stats.practiceAnswers === 1 ? "" : "s"} excluded
              </span>
            </InsetPanel>
          </>
        )}
      </div>
    </Panel>
  );
}
