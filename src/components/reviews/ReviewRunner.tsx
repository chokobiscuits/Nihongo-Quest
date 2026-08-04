"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReviewQuiz } from "./ReviewQuiz";
import { SrsStageChip } from "@/components/srs/SrsStageChip";
import { commitReviewSession, type CommitReviewSessionResult, type ReviewAnswerRecord } from "@/server/actions/reviews";
import type { ReviewSubject } from "@/server/queries/reviews";
import { CelebrationModal } from "@/components/celebration/CelebrationModal";
import { useCelebrationQueue, celebrationEventsFromCommit } from "@/components/celebration/useCelebrationQueue";

export interface ReviewRunnerProps {
  items: ReviewSubject[];
}

type Phase = "quiz" | "done";

/// Orchestrates one review session: no teach phase, straight into
/// ReviewQuiz, then commit. All writes deferred to `commitReviewSession`,
/// called once at the end — mirrors LessonRunner's shape.
export function ReviewRunner({ items }: ReviewRunnerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("quiz");
  const [result, setResult] = useState<CommitReviewSessionResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const celebration = useCelebrationQueue();

  async function handleQuizComplete(answers: ReviewAnswerRecord[]) {
    setCommitting(true);
    setError(null);
    try {
      const res = await commitReviewSession({ answers });
      setResult(res);
      setPhase("done");
      celebration.enqueue(celebrationEventsFromCommit(res));
    } catch {
      setError("Something went wrong saving this review session. Your progress in this session is safe to retry.");
    } finally {
      setCommitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full text-h1"
          style={{ background: "color-mix(in oklch, var(--color-success) 18%, transparent)", color: "var(--color-success)" }}
        >
          ✓
        </span>
        <p className="text-body font-medium text-text">Nothing to review right now.</p>
        <p className="text-caption text-text-dim">Learn something new to build up your review queue.</p>
        <Link
          href="/lessons"
          className="mt-2 inline-flex h-10 items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand"
        >
          Go to Lessons
        </Link>
      </div>
    );
  }

  if (phase === "quiz") {
    return <ReviewQuiz items={items} onComplete={handleQuizComplete} />;
  }

  if (phase === "done" && result) {
    const promoted = result.itemOutcomes.filter((o) => o.promoted);
    const demoted = result.itemOutcomes.filter((o) => o.endedStage < o.startedStage);
    const guruItems = result.itemOutcomes.filter((o) => o.reachedGuru);
    const burnedItems = result.itemOutcomes.filter((o) => o.reachedBurned);

    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        {celebration.active && (
          <CelebrationModal events={celebration.events} onDismissAll={celebration.dismiss} />
        )}
        <h2 className="text-h2 font-semibold text-text">Review session complete</h2>
        <p className="text-body text-text-muted">
          Reviewed {result.itemsReviewed} item{result.itemsReviewed === 1 ? "" : "s"}, {result.accuracyPct}% accuracy,
          earned {result.xpAwarded} XP.
        </p>

        {(promoted.length > 0 || demoted.length > 0) && (
          <div className="flex flex-col gap-2">
            <span className="text-caption uppercase tracking-wide text-text-faint">Stage changes</span>
            <div className="flex flex-wrap gap-2">
              {result.itemOutcomes.map((o) => (
                <div key={o.userSubjectId} className="flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-line bg-surface-2 px-2 py-1">
                  <SrsStageChip stage={o.startedStage} />
                  <span className="text-caption text-text-faint" aria-hidden>
                    →
                  </span>
                  <SrsStageChip stage={o.endedStage} />
                </div>
              ))}
            </div>
          </div>
        )}

        {guruItems.length > 0 && (
          <p className="text-body text-brand-text">
            {guruItems.length} item{guruItems.length === 1 ? "" : "s"} reached Guru.
          </p>
        )}
        {burnedItems.length > 0 && (
          <p className="text-body text-brand-text">
            {burnedItems.length} item{burnedItems.length === 1 ? "" : "s"} Burned.
          </p>
        )}

        {result.leveledUp && (
          <p className="text-body text-brand-text">
            Level up: {result.previousLevel} → {result.newLevel}.
          </p>
        )}
        {result.rankPromoted && (
          <p className="text-body text-brand-text">
            Rank up: {result.previousRank.tier} → {result.newRank.tier}.
          </p>
        )}
        {result.newlyUnlockedSubjectIds.length > 0 && (
          <p className="text-body text-text-muted">
            {result.newlyUnlockedSubjectIds.length} new item{result.newlyUnlockedSubjectIds.length === 1 ? "" : "s"} unlocked.
          </p>
        )}

        {error && <p className="text-caption text-danger">{error}</p>}

        <button
          type="button"
          onClick={() => router.refresh()}
          disabled={committing}
          className="self-start rounded-[var(--radius-chip)] bg-brand-button px-4 h-9 text-body font-medium text-on-brand"
        >
          Continue
        </button>
      </div>
    );
  }

  return null;
}
