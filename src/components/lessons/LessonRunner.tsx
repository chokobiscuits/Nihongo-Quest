"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LessonTeachCard } from "./LessonTeachCard";
import { LessonQuiz } from "./LessonQuiz";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { commitLessonSession, type CommitLessonSessionResult, type LessonQuizAnswerRecord } from "@/server/actions/lessons";
import type { LessonSubject } from "@/server/queries/lessons";
import { CelebrationModal } from "@/components/celebration/CelebrationModal";
import { useCelebrationQueue, celebrationEventsFromCommit } from "@/components/celebration/useCelebrationQueue";

export interface LessonRunnerProps {
  batch: LessonSubject[];
}

type Phase = "teach" | "quiz" | "done";

/// Orchestrates one lesson session: teach carousel (previous/next through
/// every item, tracking which have been viewed) -> quiz -> commit. All
/// writes are deferred to `commitLessonSession`, called once at the end.
export function LessonRunner({ batch }: LessonRunnerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("teach");
  const [index, setIndex] = useState(0);
  const [viewed, setViewed] = useState<Set<number>>(new Set([0]));
  const [result, setResult] = useState<CommitLessonSessionResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const celebration = useCelebrationQueue();

  const allViewed = viewed.size >= batch.length;

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(batch.length - 1, next));
    setIndex(clamped);
    setViewed((prev) => new Set(prev).add(clamped));
  }

  async function handleQuizComplete(answers: LessonQuizAnswerRecord[]) {
    setCommitting(true);
    setError(null);
    try {
      const res = await commitLessonSession({
        subjectIds: batch.map((s) => s.id),
        answers,
      });
      setResult(res);
      setPhase("done");
      // Fire celebrations only now — after the session has actually
      // committed, never mid-session.
      celebration.enqueue(celebrationEventsFromCommit(res));
    } catch {
      setError("Something went wrong saving this lesson. Your progress in this session is safe to retry.");
    } finally {
      setCommitting(false);
    }
  }

  if (batch.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-body text-text-dim">
        No lessons available right now. Come back once more items unlock.
      </div>
    );
  }

  if (phase === "quiz") {
    return <LessonQuiz subjects={batch} onComplete={handleQuizComplete} />;
  }

  if (phase === "done" && result) {
    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        {celebration.active && (
          <CelebrationModal events={celebration.events} onDismissAll={celebration.dismiss} />
        )}
        <h2 className="text-h2 font-semibold text-text">Lesson complete</h2>
        <p className="text-body text-text-muted">
          Learned {batch.length} item{batch.length === 1 ? "" : "s"}, earned {result.xpAwarded} XP.
        </p>
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
        <button
          type="button"
          onClick={() => router.refresh()}
          className="self-start rounded-[var(--radius-chip)] bg-brand-button px-4 h-9 text-body font-medium text-on-brand"
        >
          Continue
        </button>
      </div>
    );
  }

  const subject = batch[index];
  const isLast = index === batch.length - 1;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <LessonTeachCard subject={subject} position={index + 1} batchSize={batch.length} />

      {error && <p className="text-caption text-danger">{error}</p>}

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-6 py-3 backdrop-blur-[8px]">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="flex h-10 min-h-[44px] items-center rounded-[var(--radius-chip)] border border-line px-4 text-body font-medium text-text-dim disabled:opacity-40 md:min-h-0"
        >
          Previous
        </button>

        <div className="flex gap-1.5">
          {batch.map((s, i) => (
            <span
              key={i}
              className="h-[3px] w-4 rounded-[var(--radius-chip)]"
              style={{
                backgroundColor:
                  i === index
                    ? SUBJECT_THEME[s.type].base
                    : viewed.has(i)
                      ? "var(--color-brand)"
                      : "var(--color-surface-3)",
              }}
            />
          ))}
        </div>

        {isLast ? (
          <button
            type="button"
            disabled={!allViewed || committing}
            title={!allViewed ? "View all items first" : undefined}
            onClick={() => setPhase("quiz")}
            className="flex h-10 min-h-[44px] items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand disabled:opacity-40 md:min-h-0"
          >
            Start Quiz
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="flex h-10 min-h-[44px] items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-body font-medium text-on-brand md:min-h-0"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
