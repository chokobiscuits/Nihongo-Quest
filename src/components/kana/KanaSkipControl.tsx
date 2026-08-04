"use client";

import { useState, useTransition } from "react";
import { skipKana, unskipKana } from "@/server/actions/kana";
import { cn } from "@/lib/utils";

export interface KanaSkipControlProps {
  /// Whether the user currently has every kana resolved (passed or
  /// skipped) — flips the control between "I already know kana" and
  /// "Undo skip".
  initialResolved: boolean;
  className?: string;
}

/// The "I already know kana" skip action and its reversal, shared between
/// the kana browse page and Settings. Server-validated: skipKana/unskipKana
/// re-derive everything from the DB, this component only triggers them and
/// reflects the result.
export function KanaSkipControl({ initialResolved, className }: KanaSkipControlProps) {
  const [resolved, setResolved] = useState(initialResolved);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSkip() {
    startTransition(async () => {
      const result = await skipKana();
      setResolved(true);
      setMessage(result.skipped > 0 ? `Marked ${result.skipped} kana as known.` : "Kana already marked as known.");
    });
  }

  function handleUnskip() {
    startTransition(async () => {
      const result = await unskipKana();
      setResolved(result.kept > 0); // still resolved if some rows had real review history left in place
      setMessage(
        result.removed > 0
          ? `Reset ${result.removed} kana back to not-started.${result.kept > 0 ? ` ${result.kept} with review history were kept.` : ""}`
          : "Nothing to reset — every kana row has real review history.",
      );
    });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {resolved ? (
        <button
          type="button"
          onClick={handleUnskip}
          disabled={pending}
          className="w-fit rounded-[var(--radius-chip)] border border-line-strong bg-surface-2 px-4 h-9 text-body font-medium text-text hover:bg-surface-3 disabled:opacity-60"
        >
          Undo &quot;I already know kana&quot;
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSkip}
          disabled={pending}
          className="w-fit rounded-[var(--radius-chip)] bg-brand-button px-4 h-9 text-body font-medium text-on-brand disabled:opacity-60"
        >
          I already know kana
        </button>
      )}
      {message && <p className="text-caption text-text-dim">{message}</p>}
    </div>
  );
}
