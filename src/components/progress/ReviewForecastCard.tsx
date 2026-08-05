"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import type { ForecastBucket } from "@/services/reviews/forecast";
import { useMountedFraction } from "@/hooks/useMountedFraction";
import { cn } from "@/lib/utils";

export interface ReviewForecastCardProps {
  buckets: ForecastBucket[];
  /// Renders the "Sample data" badge. See MOCK_FORECAST for why this exists.
  isMock?: boolean;
  className?: string;
}

// MOCKUP DATA -- not wired to getReviewForecast.
//
// The forecast query and its pure bucketing service are built and tested
// (src/services/reviews/forecast.ts), but the database holds almost no
// ReviewLog history yet, so a live card would render as an empty state with
// nothing to lay out against. These numbers exist so the card can be
// designed and reviewed on the dev server before there is real data.
//
// To go live: delete this constant, call getReviewForecast(userId) in the
// page, and drop the isMock prop. The component itself needs no changes --
// it already takes the real ForecastBucket[] shape.
export const MOCK_FORECAST: ForecastBucket[] = [
  { offsetHours: 0, labelEn: "Next 4 hours", count: 23, cumulative: 23 },
  { offsetHours: 4, labelEn: "Next 8 hours", count: 11, cumulative: 34 },
  { offsetHours: 8, labelEn: "Tomorrow", count: 38, cumulative: 72 },
  { offsetHours: 24, labelEn: "In 2 days", count: 19, cumulative: 91 },
  { offsetHours: 48, labelEn: "In a week", count: 64, cumulative: 155 },
  { offsetHours: 168, labelEn: "In 2 weeks", count: 27, cumulative: 182 },
  { offsetHours: 336, labelEn: "In a month", count: 41, cumulative: 223 },
  { offsetHours: 720, labelEn: "Later", count: 86, cumulative: 309 },
];

/// Column chart of reviews already scheduled to come due, by window.
///
/// Deliberately not a projection: every number here is derived from stored
/// `dueAt` values, so the card answers "what is coming and when" rather than
/// "if you review N per day you will reach level X", which would require
/// modeling future behavior. See the forecast section in docs/roadmap.md.
export function ReviewForecastCard({ buckets, isMock, className }: ReviewForecastCardProps) {
  const sweep = useMountedFraction(1, 160);
  const peak = Math.max(...buckets.map((b) => b.count), 1);
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const dueSoon = buckets[0]?.count ?? 0;
  // Cumulative through the "In a week" bucket, whose offset is 48h: its
  // cumulative field already counts everything due at or before it.
  const dueThisWeek = buckets.find((b) => b.offsetHours === 48)?.cumulative ?? total;

  return (
    <Panel
      accent="var(--color-vocab)"
      title="Review Forecast"
      titleJa="復習予定"
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
        {total === 0 ? (
          <InsetPanel className="py-6 text-center">
            <p className="text-body text-text-dim" lang="en">
              Nothing scheduled yet
            </p>
            <p className="mt-1 text-caption text-text-faint" lang="en">
              Finish a lesson and your first reviews will appear here.
            </p>
          </InsetPanel>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-h1 font-semibold tabular-nums text-text" lang="en">
                {dueSoon.toLocaleString()}
              </span>
              <span className="text-caption text-text-faint" lang="en">
                due in the next 4 hours
              </span>
            </div>

            {/*
              Plain column chart: a fixed-height row, each column a
              bottom-anchored bar. No track behind the bars and only a 2px
              radius -- a large radius on a full-width column turns it into a
              lozenge, and a filled track makes every column read as full.
              The percentage height needs the h-28 row to resolve against;
              a % height inside an auto-height flex column collapses.
            */}
            <div
              className="flex h-28 items-end gap-2 sm:gap-3"
              role="img"
              aria-label={`${total} reviews scheduled across the next month and beyond`}
            >
              {buckets.map((bucket) => {
                const fill = (bucket.count / peak) * sweep;
                const isNow = bucket.offsetHours === 0;
                const cumulativePct = Math.round((bucket.cumulative / total) * 100);
                return (
                  <div
                    key={bucket.offsetHours}
                    className="flex h-full min-w-0 flex-1 items-end"
                    title={`${bucket.labelEn}: ${bucket.count} due (${cumulativePct}% of the queue by then)`}
                  >
                    <div
                      className="w-full rounded-[2px] transition-[height] duration-700 ease-[var(--ease-out)] hover:brightness-110"
                      style={{
                        // Floor keeps an empty window visible as a sliver
                        // rather than an apparently missing column.
                        height: `max(2px, ${fill * 100}%)`,
                        background: isNow ? "var(--color-brand)" : "var(--color-vocab)",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Counts and labels as a separate axis row, so the bars keep a
                clean shared baseline instead of each column being a stack. */}
            <div className="flex gap-2 sm:gap-3">
              {buckets.map((bucket) => {
                const isNow = bucket.offsetHours === 0;
                return (
                  <div key={bucket.offsetHours} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        "text-caption tabular-nums",
                        isNow ? "font-semibold text-text" : "text-text-dim",
                      )}
                      lang="en"
                    >
                      {bucket.count}
                    </span>
                    <span
                      className="w-full truncate text-center text-micro text-text-faint"
                      lang="en"
                      title={bucket.labelEn}
                    >
                      {bucket.labelEn.replace(/^(Next|In a|In) /, "")}
                    </span>
                  </div>
                );
              })}
            </div>

            <InsetPanel className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-caption text-text-faint" lang="en">
                  Due within a week
                </span>
                <span className="text-h3 font-semibold tabular-nums text-text" lang="en">
                  {dueThisWeek.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-caption text-text-faint" lang="en">
                  Scheduled overall
                </span>
                <span className="text-h3 font-semibold tabular-nums text-text" lang="en">
                  {total.toLocaleString()}
                </span>
              </div>
            </InsetPanel>
          </>
        )}
      </div>
    </Panel>
  );
}
