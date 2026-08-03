"use client";

import { Panel, InsetPanel } from "@/components/panel/Panel";
import type { OverallProgressRow } from "@/server/queries/progress";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { useMountedFraction } from "@/hooks/useMountedFraction";

export interface OverallProgressCardProps {
  rows: OverallProgressRow[];
  className?: string;
}

/// Passed-vs-started-vs-total per content type, laddered against their real
/// denominators (radicals 190, kanji/vocab live from the DB). A bar per row
/// with two segments: solid = passed, translucent = started-but-not-passed,
/// so partial work is never invisible even when passed is 0.
export function OverallProgressCard({ rows, className }: OverallProgressCardProps) {
  return (
    <Panel accent="var(--color-brand)" title="Overall Progress" titleJa="総合進捗" className={className}>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <OverallRow key={row.type} row={row} />
        ))}
      </div>
    </Panel>
  );
}

function OverallRow({ row }: { row: OverallProgressRow }) {
  const theme = SUBJECT_THEME[row.type];
  const startedOnly = Math.max(row.started - row.passed, 0);
  const passedFraction = row.total > 0 ? row.passed / row.total : 0;
  const startedFraction = row.total > 0 ? startedOnly / row.total : 0;
  const sweptPassed = useMountedFraction(passedFraction, 80);
  const sweptStarted = useMountedFraction(startedFraction, 80);

  return (
    <InsetPanel className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sub font-medium text-text" lang="en">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: theme.base }} />
          {row.labelEn}
        </span>
        <span className="text-caption text-text-dim" lang="en">
          {row.passed.toLocaleString()} / {row.total.toLocaleString()}
          {startedOnly > 0 && <span className="text-text-faint"> · {startedOnly.toLocaleString()} learning</span>}
        </span>
      </div>
      <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full transition-[width] duration-500 ease-[var(--ease-out)]"
          style={{ width: `${sweptPassed * 100}%`, background: theme.base }}
        />
        <div
          className="h-full transition-[width] duration-500 ease-[var(--ease-out)]"
          style={{ width: `${sweptStarted * 100}%`, background: `color-mix(in oklch, ${theme.base} 35%, transparent)` }}
        />
      </div>
    </InsetPanel>
  );
}
