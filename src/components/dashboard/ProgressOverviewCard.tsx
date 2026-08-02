"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import { ProgressRing } from "@/components/stats/ProgressRing";
import type { DashboardProgressRow } from "@/server/queries/dashboard";
import { useCountUp } from "@/hooks/useCountUp";

export interface ProgressOverviewCardProps {
  rows: DashboardProgressRow[];
  className?: string;
}

/// §7 Progress Overview: multi-segment donut for 総合進捗 (overall
/// progress) plus a per-type legend. Every row always renders with its real
/// denominator (e.g. `0 / 2,136`) even at zero — the empty donut track and
/// the legend's scope are what's motivating here, not a hidden panel.
export function ProgressOverviewCard({ rows, className }: ProgressOverviewCardProps) {
  const totalLearned = rows.reduce((acc, r) => acc + r.learned, 0);
  const totalOverall = rows.reduce((acc, r) => acc + r.total, 0);
  const overallPct = totalOverall > 0 ? Math.round((totalLearned / totalOverall) * 100) : 0;
  const displayedPct = useCountUp(overallPct);

  const segments = rows.map((row) => ({
    value: row.learned,
    color: `var(--color-${subjectAccentKey(row.type)})`,
    label: row.labelEn,
  }));

  return (
    <Panel accent="var(--color-brand)" title="Progress Overview" titleJa="総合進捗" className={className}>
      <div className="flex flex-col items-center gap-4">
        <ProgressRing
          segments={segments}
          total={totalOverall}
          size={128}
          strokeWidth={14}
          centerLabel={`${displayedPct}%`}
          centerSubLabel="総合進捗"
          sweepDelayMs={0}
        />

        <InsetPanel className="flex w-full flex-col gap-2">
          {rows.map((row) => (
            <div key={row.type} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: `var(--color-${subjectAccentKey(row.type)})` }}
                />
                <span className="text-caption text-text-muted" lang="en">
                  {row.labelEn}
                </span>
              </div>
              <span className="text-caption font-medium text-text" lang="en">
                {row.learned.toLocaleString()} / {row.total.toLocaleString()}
              </span>
            </div>
          ))}
        </InsetPanel>
      </div>
    </Panel>
  );
}

function subjectAccentKey(type: DashboardProgressRow["type"]): string {
  switch (type) {
    case "RADICAL": return "radical";
    case "KANJI": return "kanji";
    case "VOCAB": return "vocab";
    case "GRAMMAR": return "grammar";
    case "SENTENCE": return "sentence";
    case "READING": return "reading";
  }
}
