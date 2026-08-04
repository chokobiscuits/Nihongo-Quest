"use client";

export interface SuccessRateProps {
  /// Percentage 0-100, already rounded by the server.
  accuracyPct: number;
  /// Items answered cleanly (never missed) out of the session total. These
  /// count *items*, not questions, so they line up with what the user thinks
  /// of as "got it right".
  correctItems: number;
  totalItems: number;
}

/// Colour bands for the rate. Deliberately generous at the bottom: a low
/// score in an SRS session means the items were due for exactly that reason,
/// so the UI should read as information rather than judgement.
function rateColor(pct: number): string {
  if (pct >= 90) return "var(--color-success)";
  if (pct >= 70) return "var(--color-rank-gold)";
  if (pct >= 50) return "var(--color-vocab)";
  return "var(--color-danger)";
}

/// Session success rate: the headline percentage, a bar, and the underlying
/// item counts so the number is never presented without its denominator.
export function SuccessRate({ accuracyPct, correctItems, totalItems }: SuccessRateProps) {
  const color = rateColor(accuracyPct);

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-caption uppercase tracking-wide text-text-faint">Success rate</span>
        <span className="text-caption text-text-dim">
          {correctItems} of {totalItems} item{totalItems === 1 ? "" : "s"} clean
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-h1 font-semibold tabular-nums" style={{ color }}>
          {accuracyPct}%
        </span>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={accuracyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Session success rate"
        >
          <div className="h-full rounded-full" style={{ width: `${accuracyPct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}
