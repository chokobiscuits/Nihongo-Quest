"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { grade } from "@/services/answer/grade";
import { acceptMeaningAnswer } from "@/server/actions/mnemonics";
import { FuriganaText } from "@/components/furigana/FuriganaText";
import { renderFurigana } from "@/services/furigana/render";
import { xpForCorrectAnswer, xpForIncorrectAnswer } from "@/services/xp/curve";
import { SrsStageChip } from "@/components/srs/SrsStageChip";
import { XpPopupLayer, type XpPopupLayerHandle } from "@/components/lessons/XpPopupLayer";
import { buildReviewQueue, type ReviewCandidate, type ReviewQuestion } from "@/services/reviews/queue";
import type { ReviewSubject } from "@/server/queries/reviews";
import type { ReviewAnswerRecord } from "@/server/actions/reviews";
import { cn } from "@/lib/utils";

export interface ReviewQuizProps {
  items: ReviewSubject[];
  onComplete: (answers: ReviewAnswerRecord[]) => void;
}

interface RunnerQuestion extends ReviewQuestion {
  subject: ReviewSubject;
  incorrectCount: number;
}

function toCandidates(items: ReviewSubject[]): ReviewCandidate[] {
  return items.map((i) => ({ userSubjectId: i.id, subjectType: i.type }));
}

/// Quizzes a review batch, one question at a time, interleaved via
/// buildReviewQueue so an item's meaning/reading questions are never
/// adjacent. Wrong answers re-queue to the back exactly like the lesson
/// quiz. Every sub-answer (right or wrong) is recorded; the caller resolves
/// each item's final SRS transition once every kind has been answered
/// correctly at least once (the last recorded answer per kind wins).
export function ReviewQuiz({ items, onComplete }: ReviewQuizProps) {
  const bySubjectId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const [queue, setQueue] = useState<RunnerQuestion[]>(() =>
    buildReviewQueue(toCandidates(items)).map((q) => ({ ...q, subject: bySubjectId.get(q.userSubjectId)!, incorrectCount: 0 })),
  );
  const [answers, setAnswers] = useState<ReviewAnswerRecord[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(() => queue.length);
  const [incorrectTotal, setIncorrectTotal] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<null | "almost" | "wrongType" | "incorrect">(null);
  const [justWrong, setJustWrong] = useState(false);
  const [lastWrongAnswer, setLastWrongAnswer] = useState("");
  const xpPopupRef = useRef<XpPopupLayerHandle>(null);
  // Guards against onComplete firing twice (e.g. a re-render racing the
  // effect below, or StrictMode double-invoking) — commit exactly once.
  const completedRef = useRef(false);

  const current = queue[0];
  const theme = current ? SUBJECT_THEME[current.subject.type] : null;

  useEffect(() => {
    if (queue.length === 0 && !completedRef.current) {
      completedRef.current = true;
      onComplete(answers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length]);

  if (!current) {
    return null;
  }

  function recordAndAdvance(record: ReviewAnswerRecord) {
    const nextAnswers = [...answers, record];
    setAnswers(nextAnswers);
    setInput("");
    setFeedback(null);
    setJustWrong(false);
    setQueue((prev) => prev.slice(1));
  }

  function submit() {
    if (!current) return;
    const answer = input.trim();
    if (answer.length === 0) return;

    const result = grade(current.kind, answer, {
      meanings: current.subject.meanings,
      readings: current.subject.readings,
      acceptedMeanings: current.subject.acceptedMeanings,
    });

    if (result.result === "correct") {
      xpPopupRef.current?.spawn(xpForCorrectAnswer(current.subject.srsStage));
      recordAndAdvance({
        userSubjectId: current.userSubjectId,
        questionType: current.kind,
        correct: true,
        incorrectCount: current.incorrectCount,
      });
      return;
    }

    if (result.result === "almost" || result.result === "wrongType") {
      setFeedback(result.result);
      return;
    }

    // incorrect: log it now (the item is marked wrong for this session
    // regardless of whether the retry afterward succeeds), then re-queue the
    // question to the back so the item still needs to be answered correctly
    // before the session ends.
    setFeedback("incorrect");
    setJustWrong(true);
    setLastWrongAnswer(answer);
    setInput("");
  }

  function continueAfterWrong() {
    const wrongRecord: ReviewAnswerRecord = {
      userSubjectId: current.userSubjectId,
      questionType: current.kind,
      correct: false,
      incorrectCount: current.incorrectCount + 1,
    };
    setAnswers((prev) => [...prev, wrongRecord]);
    setIncorrectTotal((n) => n + 1);
    setFeedback(null);
    setJustWrong(false);
    setInput("");
    setQueue((prev) => {
      const [head, ...rest] = prev;
      const requeued = { ...head, incorrectCount: head.incorrectCount + 1 };
      setTotalQuestions((t) => t + 1);
      return [...rest, requeued];
    });
  }

  async function markShouldHaveBeenCorrect() {
    if (!current || current.kind !== "MEANING") return;
    await acceptMeaningAnswer(current.subject.subjectId, lastWrongAnswer);
    xpPopupRef.current?.spawn(xpForCorrectAnswer(current.subject.srsStage));
    recordAndAdvance({
      userSubjectId: current.userSubjectId,
      questionType: current.kind,
      correct: true,
      incorrectCount: current.incorrectCount,
    });
  }

  const answeredCount = totalQuestions - queue.length;
  const incorrectFraction = totalQuestions === 0 ? 0 : incorrectTotal / totalQuestions;
  const progressFraction = totalQuestions === 0 ? 0 : answeredCount / totalQuestions;

  return (
    <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-caption text-text-dim">
          <span>
            {answeredCount} / {totalQuestions}
          </span>
          <span className="uppercase tracking-wide" style={{ color: theme?.base }}>
            {current.kind === "MEANING" ? "Meaning" : "Reading"}
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 bg-danger/40"
            style={{ width: `${Math.min(100, incorrectFraction * 100)}%` }}
          />
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 bg-brand-button"
            style={{ width: `${Math.min(100, progressFraction * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 py-4">
        <SrsStageChip stage={current.subject.srsStage} />
        {current.subject.type === "SENTENCE" ? (
          <span lang="ja" className="max-w-[560px] text-center text-h1 leading-loose" style={{ color: theme?.text }}>
            {current.subject.furigana ? (
              <FuriganaText render={renderFurigana(current.subject.furigana, true)} fallback={current.subject.furiganaFallback} />
            ) : (
              current.subject.characters
            )}
          </span>
        ) : current.subject.type === "GRAMMAR" ? (
          <span lang="ja" className="max-w-[560px] text-center text-h1" style={{ color: theme?.text }}>
            {current.subject.characters}
          </span>
        ) : (
          <span lang="ja" className="subject-glyph text-glyph-sm" style={{ color: theme?.text }}>
            {current.subject.characters}
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <div className="relative">
          <input
            autoFocus
            type="text"
            lang={current.kind === "READING" ? "ja" : "en"}
            value={input}
            disabled={feedback === "incorrect"}
            onChange={(e) => {
              setInput(e.target.value);
              if (feedback === "almost" || feedback === "wrongType") setFeedback(null);
            }}
            placeholder={current.kind === "MEANING" ? "Meaning" : "Reading"}
            className={cn(
              "w-full rounded-[var(--radius-input)] border bg-surface-2 p-3 text-body text-text outline-none disabled:opacity-70",
              justWrong ? "border-danger" : "border-line-strong",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
            )}
          />
          <XpPopupLayer ref={xpPopupRef} />
        </div>

        {feedback === "almost" && (
          <p className="text-caption text-warn">Close, check your spelling and try again.</p>
        )}
        {feedback === "wrongType" && (
          <p className="text-caption text-warn">
            That looks like a {current.kind === "MEANING" ? "reading" : "meaning"} answer, try again.
          </p>
        )}
        {feedback === "incorrect" && (
          <p className="text-caption text-danger">
            Not quite. This item will come back around later in this session.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          {feedback === "incorrect" ? (
            <button
              type="button"
              onClick={continueAfterWrong}
              className="rounded-[var(--radius-chip)] bg-brand-button px-4 h-9 text-body font-medium text-on-brand"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-[var(--radius-chip)] bg-brand-button px-4 h-9 text-body font-medium text-on-brand"
            >
              Answer
            </button>
          )}
          {feedback === "incorrect" && current.kind === "MEANING" && (
            <button
              type="button"
              onClick={markShouldHaveBeenCorrect}
              className="text-caption text-text-dim underline hover:text-text"
            >
              I should have been marked correct
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// Referenced only for type-check parity with xpForIncorrectAnswer's shape —
// XP for incorrect answers is awarded server-side in commitReviewSession,
// not popped client-side (a wrong answer doesn't get a celebratory popup).
void xpForIncorrectAnswer;
