"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReviewQuiz } from "./ReviewQuiz";
import { SrsStageChip } from "@/components/srs/SrsStageChip";
import { SuccessRate } from "./SuccessRate";
import { commitReviewSession, type CommitReviewSessionResult, type ReviewAnswerRecord } from "@/server/actions/reviews";
import type { ReviewSubject } from "@/server/queries/reviews";
import { CelebrationModal } from "@/components/celebration/CelebrationModal";
import { useCelebrationQueue, celebrationEventsFromCommit } from "@/components/celebration/useCelebrationQueue";
import { useSound } from "@/lib/sound/useSound";

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
  const play = useSound();

  // Held so a failed commit can be retried without losing the session's
  // answers — the quiz component is already unmounted by this point.
  const [pendingAnswers, setPendingAnswers] = useState<ReviewAnswerRecord[] | null>(null);

  async function commit(answers: ReviewAnswerRecord[]) {
    setCommitting(true);
    setError(null);
    try {
      const res = await commitReviewSession({ answers });
      setResult(res);
      setPhase("done");
      // Exactly one session sound, never a pile-up. SRS pass/fail is only
      // knowable here — the quiz sees correct/wrong per answer, but whether
      // an item actually moved up or down a stage is resolved server-side.
      // A demotion is the more important thing to hear, so it wins.
      const events = celebrationEventsFromCommit(res);
      // Skip the session sound entirely when a stinger is queued — the
      // celebration is the louder, more meaningful close, and playing both
      // back to back just sounds like a stutter.
      if (events.length === 0) {
        const anyDemoted = res.itemOutcomes.some((o) => o.endedStage < o.startedStage);
        const anyPromoted = res.itemOutcomes.some((o) => o.promoted);
        play(anyDemoted ? "review.fail" : anyPromoted ? "review.pass" : "session.complete");
      }
      celebration.enqueue(events);
    } catch {
      setError("Something went wrong saving this review session. Your progress in this session is safe to retry.");
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

  // See UnrankedRunner: the quiz unmounts as soon as it hands over answers,
  // so this branch covers the commit round-trip and any failure rather than
  // leaving a blank page behind.
  if (phase === "quiz" && pendingAnswers) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        {committing ? (
          <p className="text-body text-text-muted">Saving your review session…</p>
        ) : (
          <>
            <h2 className="text-h2 font-semibold text-text">Couldn&apos;t save this session</h2>
            <p className="text-body text-text-muted">{error}</p>
            <button
              type="button"
              onClick={() => commit(pendingAnswers)}
              className="h-9 w-fit rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand"
            >
              Try again
            </button>
          </>
        )}
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
      <div className="entrance flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        {celebration.active && (
          <CelebrationModal events={celebration.events} onDismissAll={celebration.dismiss} />
        )}
        <h2 className="text-h2 font-semibold text-text">Review session complete</h2>
        <p className="text-body text-text-muted">
          Reviewed {result.itemsReviewed} item{result.itemsReviewed === 1 ? "" : "s"}, earned {result.xpAwarded} XP.
        </p>

        <SuccessRate
          accuracyPct={result.accuracyPct}
          correctItems={result.itemsCorrect}
          totalItems={result.itemsReviewed}
        />

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

        {/* LP is the ranked track: always reported, since a session that
            moved no rank still moved (or deliberately did not move) LP. */}
        {result.lpDelta !== 0 && (
          <p className={result.lpDelta > 0 ? "text-body text-brand-text" : "text-body text-text-muted"}>
            {result.lpDelta > 0 ? "+" : ""}
            {result.lpDelta} LP
            {result.lpBonus === "perfect"
              ? " — perfect clear!"
              : result.lpBonus === "s-rank"
                ? " — S-rank session!"
                : ""}
          </p>
        )}
        {result.rankPromoted && (
          <p className="text-body text-brand-text">
            Rank up: {result.previousRank.tier} {result.previousRank.division ?? ""} → {result.newRank.tier}{" "}
            {result.newRank.division ?? ""}.
          </p>
        )}
        {result.rankDemoted && (
          <p className="text-body text-text-muted">
            Rank down: {result.previousRank.tier} {result.previousRank.division ?? ""} → {result.newRank.tier}{" "}
            {result.newRank.division ?? ""}. Your tier is safe.
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
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
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
