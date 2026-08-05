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
            <div
              className="flex h-32 items-end gap-1.5"
              role="img"
              aria-label={`${total} reviews scheduled across the next month and beyond`}
            >
              {buckets.map((bucket) => {
                const height = (bucket.count / peak) * sweep;
                const isNow = bucket.offsetHours === 0;
                return (
                  <div key={bucket.offsetHours} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="text-micro tabular-nums text-text-faint" lang="en">
                      {bucket.count || ""}
                    </span>
                    <div
                      title={`${bucket.labelEn}: ${bucket.count}`}
                      className={cn(
                        "w-full rounded-t-[var(--radius-chip)] transition-[height] duration-500 ease-[var(--ease-out)]",
                        bucket.count === 0 && "opacity-40",
                      )}
                      style={{
                        // Floor at 2px so an empty window still reads as a
                        // column rather than a gap in the axis.
                        height: `max(2px, ${height * 100}%)`,
                        background: isNow ? "var(--color-brand)" : "var(--color-vocab)",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-1.5">
              {buckets.map((bucket) => (
                <span
                  key={bucket.offsetHours}
                  className="min-w-0 flex-1 truncate text-center text-micro text-text-faint"
                  lang="en"
                  title={bucket.labelEn}
                >
                  {bucket.labelEn.replace(/^(Next|In a|In) /, "")}
                </span>
              ))}
            </div>

            <InsetPanel className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-caption text-text-faint" lang="en">
                  Due in the next 4 hours
                </span>
                <span className="text-h3 font-semibold tabular-nums text-text" lang="en">
                  {dueSoon.toLocaleString()}
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
