"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acknowledgeTutorialAction, acknowledgeAllTutorialsAction } from "@/server/actions/tutorials";

export interface MarkReadButtonProps {
  tutorialId: string;
  completed: boolean;
  /// Where to go once acknowledged. Defaults to refreshing in place, which
  /// is right for the library. First-run onboarding passes "/" so marking
  /// read lands on the dashboard instead of leaving you on the tutorial.
  redirectTo?: string;
  label?: string;
}

/// "Mark as read" on the tutorial detail page. The gate on /lessons has its
/// own button, but a tutorial opened from the library had no way to be
/// completed from where it is actually being read.
export function MarkReadButton({ tutorialId, completed, redirectTo, label }: MarkReadButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (completed) {
    // Already-read tutorials still need a way onward when this is the
    // first page of the app, so fall through to a plain link there.
    if (redirectTo) {
      return (
        <Link
          href={redirectTo}
          className="self-start rounded-[var(--radius-chip)] bg-brand-button px-4 h-9 inline-flex items-center text-body font-medium text-on-brand hover:bg-brand-button-hover transition-colors duration-[var(--duration-fast)]"
        >
          {label ?? "Continue"}
        </Link>
      );
    }
    return (
      <p className="text-caption text-text-dim" lang="en">
        You have already marked this as read.
      </p>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await acknowledgeTutorialAction(tutorialId);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } catch {
        setError("Something went wrong saving this. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-caption text-danger">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="self-start rounded-[var(--radius-chip)] bg-brand-button px-4 h-9 text-body font-medium text-on-brand hover:bg-brand-button-hover transition-colors duration-[var(--duration-fast)] disabled:opacity-60"
      >
        {pending ? "Saving..." : (label ?? "Mark as read")}
      </button>
    </div>
  );
}

/// Bulk completion for the library page. The one person using this app
/// already reads Japanese, so being gated behind six required explainers is
/// friction. Nothing is deleted, so this is reversible.
export function MarkAllReadButton({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (remaining === 0) {
    return (
      <span className="text-caption text-text-dim" lang="en">
        All tutorials marked as read.
      </span>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await acknowledgeAllTutorialsAction();
        router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-caption text-danger">{error}</span>}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-[var(--radius-chip)] border border-line-strong bg-surface-2 px-3 h-8 text-caption font-medium text-text-muted hover:bg-surface-3 hover:text-text transition-colors duration-[var(--duration-fast)] disabled:opacity-60"
      >
        {pending ? "Saving..." : `Mark all ${remaining} as read`}
      </button>
    </div>
  );
}
