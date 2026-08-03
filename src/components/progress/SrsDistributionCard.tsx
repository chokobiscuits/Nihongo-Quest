"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import type { SrsDistributionRow } from "@/server/queries/progress";
import { useMountedFraction } from "@/hooks/useMountedFraction";
import { cn } from "@/lib/utils";

export interface SrsDistributionCardProps {
  rows: SrsDistributionRow[];
  total: number;
  className?: string;
}

// One color per stage group — Apprentice (brand-ish violet ramp), Guru
// (kanji teal), Master/Enlightened (gold ramp), Burned (a settled neutral,
// matching the "done, no longer moving" state). Stage indices 1-9 index
// directly into this array.
const STAGE_COLORS = [
  "color-mix(in oklch, var(--color-brand) 55%, transparent)", // 1 Apprentice I
  "color-mix(in oklch, var(--color-brand) 70%, transparent)", // 2 Apprentice II
  "color-mix(in oklch, var(--color-brand) 85%, transparent)", // 3 Apprentice III
  "var(--color-brand)", // 4 Apprentice IV
  "color-mix(in oklch, var(--color-kanji) 70%, transparent)", // 5 Guru I
  "var(--color-kanji)", // 6 Guru II
  "var(--color-rank-gold)", // 7 Master
  "var(--color-rank-platinum)", // 8 Enlightened
  "var(--color-rank-diamond)", // 9 Burned
];

/// Horizontal stacked bar of the user's SRS stage distribution, Apprentice I
/// through Burned, plus a per-stage count legend. The single most useful
/// view in a WaniKani-style app — the bar sweeps in on mount so even a
/// small real distribution (a handful of items at one stage) reads as
/// populated, not broken.
export function SrsDistributionCard({ rows, total, className }: SrsDistributionCardProps) {
  const sweep = useMountedFraction(1, 120);

  return (
    <Panel accent="var(--color-kanji)" title="SRS Distribution" titleJa="SRS分布" className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex h-6 w-full overflow-hidden rounded-[var(--radius-chip)] bg-surface-3" role="img" aria-label={`${total} items in SRS`}>
          {total === 0 ? (
            <div className="flex w-full items-center justify-center text-micro text-text-faint" lang="en">
              No items in review yet
            </div>
          ) : (
            rows.map((row, index) => {
              if (row.count === 0) return null;
              const fraction = (row.count / total) * sweep;
              return (
                <div
                  key={row.stage}
                  title={`${row.name}: ${row.count}`}
                  className="h-full transition-[width] duration-500 ease-[var(--ease-out)]"
                  style={{ width: `${fraction * 100}%`, background: STAGE_COLORS[index] }}
                />
              );
            })
          )}
        </div>

        <InsetPanel className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {rows.map((row, index) => (
            <div key={row.stage} className={cn("flex items-center justify-between gap-2 rounded-[var(--radius-input)] px-2 py-1", row.count === 0 && "opacity-50")}>
              <div className="flex items-center gap-2 min-w-0">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STAGE_COLORS[index] }} />
                <span className="truncate text-caption text-text-muted" lang="en">
                  {row.name}
                </span>
              </div>
              <span className="shrink-0 text-caption font-medium tabular-nums text-text" lang="en">
                {row.count.toLocaleString()}
              </span>
            </div>
          ))}
        </InsetPanel>

        <span className="text-micro text-text-faint" lang="en">
          {total.toLocaleString()} item{total === 1 ? "" : "s"} currently in review
        </span>
      </div>
    </Panel>
  );
}
