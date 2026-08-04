"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetProgress, RESET_CONFIRMATION } from "@/server/actions/reset";

/// Danger-zone control for wiping all learning progress. Two-step by
/// design: the destructive button only appears after the user opens the
/// confirmation, and stays disabled until they type the confirmation word.
/// The server action re-checks that word, so this UI is a speed bump rather
/// than the actual guard.
export function ResetProgressControl() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmed = typed.trim() === RESET_CONFIRMATION;

  function handleReset() {
    if (!confirmed) return;
    startTransition(async () => {
      setError(null);
      try {
        const result = await resetProgress(typed.trim());
        setMessage(
          `Progress reset. Removed ${result.userSubjects} items, ${result.reviewLogs} review logs, ${result.sessions} sessions.`,
        );
        setOpen(false);
        setTyped("");
        router.refresh();
      } catch {
        setError("Reset failed. Nothing was changed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-body font-medium text-text">Reset all progress</span>
        <span className="text-caption text-text-dim">
          Deletes every learned item, review log, session, XP event and streak, and returns your level and rank to the
          start. Your display name, avatar and settings are kept. Seeded content is untouched.
        </span>
        <span className="text-caption font-medium text-danger">This cannot be undone.</span>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage(null);
          }}
          className="h-9 w-fit rounded-[var(--radius-chip)] border border-danger px-4 text-body font-medium text-danger hover:bg-danger/10"
        >
          Reset progress
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-danger/50 bg-surface-2 p-4">
          <label htmlFor="reset-confirm" className="text-caption text-text-dim">
            Type <span className="font-mono font-medium text-text">{RESET_CONFIRMATION}</span> to confirm.
          </label>
          <input
            id="reset-confirm"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="h-9 w-full max-w-xs rounded-[var(--radius-chip)] border border-line bg-surface px-3 text-body text-text"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!confirmed || pending}
              className="h-9 rounded-[var(--radius-chip)] bg-danger px-4 text-body font-medium text-white disabled:opacity-40"
            >
              {pending ? "Resetting…" : "Permanently reset"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
              disabled={pending}
              className="h-9 rounded-[var(--radius-chip)] border border-line px-4 text-body font-medium text-text-dim"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-caption text-text-dim">{message}</p>}
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}
