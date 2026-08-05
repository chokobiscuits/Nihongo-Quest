"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeTutorialAction } from "@/server/actions/tutorials";

/// "Skip for now" on the first-run onboarding page.
///
/// This has to acknowledge, not just navigate. The dashboard redirects any
/// account with zero TutorialCompletion rows back here, so a plain link to
/// "/" would bounce straight back and trap the user. Acknowledging flips
/// hasCompletedAnyTutorial and ends the redirect, and it honestly records
/// "I have seen this".
///
/// A dismissal cookie would be the other option, but that puts onboarding
/// state in a second place that resetting progress would not clear.
export function SkipFirstRunButton({ tutorialId }: { tutorialId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await acknowledgeTutorialAction(tutorialId);
        router.push("/");
      } catch {
        setError("Something went wrong. Try again.");
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
        className="self-start text-caption font-medium text-text-dim hover:text-text transition-colors duration-[var(--duration-fast)] disabled:opacity-60"
      >
        {pending ? "Skipping..." : "Skip to dashboard →"}
      </button>
    </div>
  );
}
