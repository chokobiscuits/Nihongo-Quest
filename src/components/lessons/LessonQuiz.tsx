"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SUBJECT_THEME } from "@/components/subject/theme";
import { grade, type QuestionKind } from "@/services/answer/grade";
import { acceptMeaningAnswer } from "@/server/actions/mnemonics";
import type { LessonSubject } from "@/server/queries/lessons";
import type { LessonQuizAnswerRecord } from "@/server/actions/lessons";
import { xpForCorrectAnswer } from "@/services/xp/curve";
import { LESSON_STAGE } from "@/services/srs/stages";
import { XpPopupLayer, type XpPopupLayerHandle } from "./XpPopupLayer";
import { cn } from "@/lib/utils";

export interface LessonQuizProps {
  subjects: LessonSubject[];
  onComplete: (answers: LessonQuizAnswerRecord[]) => void;
}

interface QuizQuestion {
  subject: LessonSubject;
  kind: QuestionKind;
  incorrectCount: number;
}

function buildQuestions(subjects: LessonSubject[]): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const subject of subjects) {
    questions.push({ subject, kind: "MEANING", incorrectCount: 0 });
    if (subject.type !== "RADICAL") {
      questions.push({ subject, kind: "READING", incorrectCount: 0 });
    }
  }
  // Simple shuffle so meaning/reading pairs for the same item aren't always
  // adjacent, matching typical SRS quiz feel.
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  return questions;
}

/// Quizzes every item in the batch with MEANING and READING questions
/// (radicals are meaning-only). Wrong answers re-queue to the back of the
/// session queue until answered correctly — a lesson never fails an item,
/// it just keeps asking.
export function LessonQuiz({ subjects, onComplete }: LessonQuizProps) {
  const [queue, setQueue] = useState<QuizQuestion[]>(() => buildQuestions(subjects));
  const [completed, setCompleted] = useState<LessonQuizAnswerRecord[]>([]);
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
  const totalQuestions = useMemo(
    () => subjects.reduce((n, s) => n + (s.type === "RADICAL" ? 1 : 2), 0),
    [subjects],
  );

  useEffect(() => {
    if (queue.length === 0 && !completedRef.current) {
      completedRef.current = true;
      onComplete(completed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length]);

  if (!current) {
    return null;
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
      xpPopupRef.current?.spawn(xpForCorrectAnswer(LESSON_STAGE));
      setCompleted((prev) => [
        ...prev,
        { subjectId: current.subject.id, questionType: current.kind, incorrectCount: current.incorrectCount },
      ]);
      setInput("");
      setFeedback(null);
      setJustWrong(false);
      setQueue((prev) => prev.slice(1));
      return;
    }

    if (result.result === "almost" || result.result === "wrongType") {
      setFeedback(result.result);
      return;
    }

    // incorrect: show feedback and the escape hatch first. The question
    // itself re-queues to the back once the user dismisses the feedback
    // (continue()), not immediately — so "I should have been marked
    // correct" still targets the question on screen.
    setFeedback("incorrect");
    setJustWrong(true);
    setLastWrongAnswer(answer);
    setInput("");
  }

  function continueAfterWrong() {
    setFeedback(null);
    setJustWrong(false);
    setInput("");
    setQueue((prev) => {
      const [head, ...rest] = prev;
      return [...rest, { ...head, incorrectCount: head.incorrectCount + 1 }];
    });
  }

  async function markShouldHaveBeenCorrect() {
    if (!current || current.kind !== "MEANING") return;
    await acceptMeaningAnswer(current.subject.id, lastWrongAnswer);
    // Flip this question to correct for the session and move on. This is
    // the "should have been marked correct" override, so it fires the XP
    // popup the same as the normal correct-answer path.
    xpPopupRef.current?.spawn(xpForCorrectAnswer(LESSON_STAGE));
    const finished = {
      subjectId: current.subject.id,
      questionType: current.kind,
      incorrectCount: current.incorrectCount,
    };
    setCompleted((prev) => [...prev, finished]);
    setInput("");
    setFeedback(null);
    setJustWrong(false);
    setQueue((prev) => prev.slice(1));
  }

  const answeredCount = totalQuestions - queue.length;

  return (
    <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <div className="flex items-center justify-between text-caption text-text-dim">
        <span>
          {answeredCount} / {totalQuestions}
        </span>
        <span className="uppercase tracking-wide" style={{ color: theme?.base }}>
          {current.kind === "MEANING" ? "Meaning" : "Reading"}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2 py-4">
        <span lang="ja" className="subject-glyph text-glyph-sm" style={{ color: theme?.text }}>
          {current.subject.characters}
        </span>
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
          <p className="text-caption text-warn">Close — check your spelling and try again.</p>
        )}
        {feedback === "wrongType" && (
          <p className="text-caption text-warn">
            That looks like a {current.kind === "MEANING" ? "reading" : "meaning"} answer — try again.
          </p>
        )}
        {feedback === "incorrect" && (
          <p className="text-caption text-danger">
            Not quite. The answer will come back around later in this lesson.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          {feedback === "incorrect" ? (
            <button
              type="button"
              onClick={continueAfterWrong}
              className="rounded-[var(--radius-chip)] bg-brand px-4 h-9 text-body font-medium text-canvas"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-[var(--radius-chip)] bg-brand px-4 h-9 text-body font-medium text-canvas"
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
