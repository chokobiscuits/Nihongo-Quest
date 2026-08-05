"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import type { ReviewStats } from "@/services/reviews/stats";
import { useMountedFraction } from "@/hooks/useMountedFraction";
import { cn } from "@/lib/utils";

export interface ReviewStatsCardProps {
  stats: ReviewStats;
  /// Renders the "Sample data" badge. See MOCK_REVIEW_STATS.
  isMock?: boolean;
  className?: string;
}

// MOCKUP DATA -- not wired to getReviewStats.
//
// Same reasoning as MOCK_FORECAST in ReviewForecastCard: the query and the
// pure buildReviewStats service exist and are tested, but there is not yet
// enough ReviewLog history for a live card to show a trend. Fourteen days of
// plausible numbers, with meaning accuracy deliberately ahead of reading
// accuracy, which is the usual pattern and the thing this card exists to
// surface.
//
// To go live: delete this constant, call getReviewStats(userId) in the page,
// drop isMock. The component already takes the real ReviewStats shape.
function mockDay(daysAgo: number, correct: number, incorrect: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  const total = correct + incorrect;
  return {
    date,
    correct,
    incorrect,
    accuracyPct: total === 0 ? 0 : Math.round((correct / total) * 1000) / 10,
  };
}

export const MOCK_REVIEW_STATS: ReviewStats = {
  split: [
    { questionType: "MEANING", correct: 486, incorrect: 61, accuracyPct: 88.8 },
    { questionType: "READING", correct: 402, incorrect: 118, accuracyPct: 77.3 },
  ],
  trend: [
    mockDay(13, 41, 9),
    mockDay(12, 55, 7),
    mockDay(11, 38, 14),
    mockDay(10, 62, 11),
    mockDay(9, 71, 8),
    mockDay(8, 44, 16),
    mockDay(7, 58, 6),
    mockDay(6, 66, 13),
    mockDay(5, 73, 9),
    mockDay(4, 51, 18),
    mockDay(3, 69, 7),
    mockDay(2, 82, 12),
    mockDay(1, 78, 10),
    mockDay(0, 60, 9),
  ],
  totalAnswers: 1067,
  overallAccuracyPct: 83.2,
  mode: "ranked",
  rankedAnswers: 1067,
  practiceAnswers: 214,
};

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
export function ReviewStatsCard({ stats, isMock, className }: ReviewStatsCardProps) {
  const sweep = useMountedFraction(1, 200);
  const hasData = stats.totalAnswers > 0;
  const peak = Math.max(...stats.trend.map((p) => p.correct + p.incorrect), 1);

  return (
    <Panel
      accent="var(--color-brand)"
      title="Review Accuracy"
      titleJa="正答率"
      className={className}
      action={
        isMock ? (
          <span
            className="rounded-[var(--radius-chip)] bg-surface-3 px-2 py-0.5 text-micro text-text-dim"
            lang="en"
          >
            Sample data
          </span>
        ) : undefined
      }
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
                      className="flex min-w-0 flex-1 flex-col justify-end"
                      style={{ height: "100%" }}
                      title={`${point.date.toISOString().slice(0, 10)}: ${point.accuracyPct}% (${point.correct}/${dayTotal})`}
                    >
                      <div
                        className="flex w-full flex-col justify-end overflow-hidden rounded-t-[var(--radius-chip)] transition-[height] duration-500 ease-[var(--ease-out)]"
                        style={{ height: `max(2px, ${height * 100}%)` }}
                      >
                        <div
                          className="w-full"
                          style={{
                            height: `${(1 - correctShare) * 100}%`,
                            background: "color-mix(in oklch, var(--color-danger) 65%, transparent)",
                          }}
                        />
                        <div
                          className="w-full"
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
