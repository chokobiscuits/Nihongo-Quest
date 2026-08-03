import { Panel, InsetPanel } from "@/components/panel/Panel";
import type { JlptProgressRow } from "@/server/queries/progress";

export interface JlptBreakdownCardProps {
  rows: JlptProgressRow[];
  note: string;
  className?: string;
}

/// N5-N1 breakdown from real `Subject.jlpt` tags. Denominators are honestly
/// scoped to JLPT-tagged items only (a minority of the full kanji/vocab set)
/// — the note under the list says so explicitly rather than implying full
/// curriculum coverage.
export function JlptBreakdownCard({ rows, note, className }: JlptBreakdownCardProps) {
  return (
    <Panel accent="var(--color-vocab)" title="JLPT Progress" titleJa="JLPT進捗" className={className}>
      <div className="flex flex-col gap-3">
        <InsetPanel className="flex flex-col gap-2">
          {rows.map((row) => {
            const pct = row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0;
            return (
              <div key={row.level} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sub font-medium text-text" lang="en">
                    N{row.level}
                  </span>
                  <span className="text-caption text-text-dim" lang="en">
                    {row.passed.toLocaleString()} / {row.total.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-vocab transition-[width] duration-500 ease-[var(--ease-out)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </InsetPanel>
        <span className="text-micro text-text-faint" lang="en">
          {note}
        </span>
      </div>
    </Panel>
  );
}
