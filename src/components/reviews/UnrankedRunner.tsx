"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReviewQuiz } from "./ReviewQuiz";
import { SuccessRate } from "./SuccessRate";
import {
  commitUnrankedReviewSession,
  type CommitUnrankedSessionResult,
  type ReviewAnswerRecord,
} from "@/server/actions/reviews";
import type { ReviewSubject } from "@/server/queries/reviews";

export interface UnrankedRunnerProps {
  items: ReviewSubject[];
  /// Back link to the picker, so a finished session can offer another round
  /// with different filters.
  pickerHref: string;
}

type Phase = "quiz" | "done";

/// Orchestrates one unranked (practice) session. Same quiz component as
/// ranked, different commit: commitUnrankedReviewSession awards no XP or
/// mastery and never moves an item's SRS stage. No celebrations either —
/// there is no progression here to celebrate.
export function UnrankedRunner({ items, pickerHref }: UnrankedRunnerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("quiz");
  const [result, setResult] = useState<CommitUnrankedSessionResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Held so a failed commit can be retried without losing the session's
  // answers — the quiz component is already unmounted by this point.
  const [pendingAnswers, setPendingAnswers] = useState<ReviewAnswerRecord[] | null>(null);

  async function commit(answers: ReviewAnswerRecord[]) {
    setCommitting(true);
    setError(null);
    try {
      const res = await commitUnrankedReviewSession({ answers });
      setResult(res);
      setPhase("done");
    } catch {
      setError("Something went wrong saving this practice session. Nothing was lost — your SRS progress is untouched either way.");
    } finally {
      setCommitting(false);
    }
  }

  async function handleQuizComplete(answers: ReviewAnswerRecord[]) {
    setPendingAnswers(answers);
    await commit(answers);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <p className="text-body font-medium text-text">Nothing matches that selection.</p>
        <p className="text-caption text-text-dim">Pick different subjects or levels to practice.</p>
        <Link
          href={pickerHref}
          className="mt-1 inline-flex h-9 w-fit items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand"
        >
          Back to picker
        </Link>
      </div>
    );
  }

  // Once the quiz hands over its answers it unmounts (its queue is empty and
  // it renders null), so this branch has to cover the commit round-trip and
  // any failure. Without it the user stares at a blank page — permanently,
  // if the commit throws.
  if (phase === "quiz" && pendingAnswers) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        {committing ? (
          <p className="text-body text-text-muted">Saving your practice session…</p>
        ) : (
          <>
            <h2 className="text-h2 font-semibold text-text">Couldn&apos;t save this session</h2>
            <p className="text-body text-text-muted">{error}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => commit(pendingAnswers)}
                className="h-9 rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand"
              >
                Try again
              </button>
              <Link
                href={pickerHref}
                className="inline-flex h-9 items-center rounded-[var(--radius-chip)] border border-line px-4 text-body font-medium text-text-dim"
              >
                Back to picker
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  if (phase === "quiz") {
    return <ReviewQuiz items={items} onComplete={handleQuizComplete} />;
  }

  if (phase === "done" && result) {
    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="text-h2 font-semibold text-text">Practice complete</h2>
        <p className="text-body text-text-muted">
          Practiced {result.itemsReviewed} item{result.itemsReviewed === 1 ? "" : "s"}.
        </p>

        <SuccessRate
          accuracyPct={result.accuracyPct}
          correctItems={result.itemsCorrect}
          totalItems={result.itemsReviewed}
        />
        {(() => {
          // Items that took more than one attempt are the actionable part of
          // a practice summary: nothing here changed their SRS stage, so this
          // is the only signal the session produced.
          const missed = result.itemResults.filter((r) => r.correct < r.total);
          if (missed.length === 0) return null;
          const labels = missed
            .map((r) => {
              const item = items.find((i) => i.id === r.userSubjectId);
              return item?.characters ?? item?.slug ?? null;
            })
            .filter((l): l is string => l !== null);
          if (labels.length === 0) return null;
          return (
            <div className="flex flex-col gap-1">
              <span className="text-caption uppercase tracking-wide text-text-faint">Worth another look</span>
              <p lang="ja" className="text-body text-text">
                {labels.join("　")}
              </p>
            </div>
          );
        })()}

        <p className="text-caption text-text-faint">
          Unranked practice: no XP, no mastery, and no change to any item&apos;s SRS stage.
        </p>

        {error && <p className="text-caption text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Link
            href={pickerHref}
            className="inline-flex h-9 items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand"
          >
            Practice again
          </Link>
          <button
            type="button"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            disabled={committing}
            className="inline-flex h-9 items-center rounded-[var(--radius-chip)] border border-line px-4 text-body font-medium text-text-dim"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
