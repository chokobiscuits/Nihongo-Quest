"use client";

import Link from "next/link";
import type { DashboardContinueCard } from "@/server/queries/dashboard";
import { typeToSlug } from "@/components/subject/typeSlug";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useMountedFraction } from "@/hooks/useMountedFraction";

export interface ContinueLearningSectionProps {
  cards: DashboardContinueCard[];
}

// Fixed accent per card position, matching the sheet's purple/blue/green/
// amber/pink sequence for 漢字/語彙/文法/文章読解/レビュー regardless of
// which SubjectType backs the slot.
const CARD_ACCENTS = [
  "var(--color-kanji)",
  "var(--color-vocab)",
  "var(--color-grammar)",
  "var(--color-sentence)",
  "var(--color-reading)",
];

/// §6 Continue Learning cards. All five card slots always render — the row
/// never reflows — with seeded cards showing real percent/lesson progress
/// and unseeded cards (grammar, readings, review) rendering a dashed
/// "準備中 / Coming soon" placeholder at the same min-height.
export function ContinueLearningSection({ cards }: ContinueLearningSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col leading-tight">
          <h2 className="text-h2 font-semibold text-text" lang="en">
            Continue Learning
          </h2>
          <span lang="ja" className="text-caption text-text-faint">
            学習を続ける
          </span>
        </div>
        <Link
          href="/lessons"
          className="inline-flex h-9 items-center rounded-[var(--radius-chip)] bg-brand-button px-4 text-caption font-semibold text-on-brand hover:bg-brand-button-hover transition-colors duration-[var(--duration-fast)]"
        >
          Study All
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-5">
        {cards.map((card, index) => (
          <ContinueLearningCard
            key={`${card.type}-${index}`}
            card={card}
            accent={CARD_ACCENTS[index % CARD_ACCENTS.length]}
            // The first seeded card is the primary CTA — it's the one that
            // gets the breathing glow, since it's the most likely next
            // action for an account with lessons available.
            isPrimaryCta={index === cards.findIndex((c) => c.seeded)}
          />
        ))}
      </div>
    </section>
  );
}

function ContinueLearningCard({
  card,
  accent,
  isPrimaryCta,
}: {
  card: DashboardContinueCard;
  accent: string;
  isPrimaryCta: boolean;
}) {
  // Hooks run unconditionally regardless of `card.seeded` — the unseeded
  // early-return branch below just never reads their output.
  const percent = card.percent ?? 0;
  const displayedPercent = useCountUp(percent);
  const sweptFraction = useMountedFraction(percent / 100, 80);

  if (!card.seeded) {
    return (
      <div
        className="flex min-w-[76vw] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-4 min-h-[190px] sm:min-w-0"
        style={{ "--accent": accent } as React.CSSProperties}
      >
        <span className="text-glyph-sm opacity-30" aria-hidden style={{ color: accent }}>
          {card.glyph}
        </span>
        <span lang="ja" className="text-caption text-text-faint">
          準備中
        </span>
        <span className="text-micro text-text-faint" lang="en">
          Coming soon
        </span>
      </div>
    );
  }

  // The Review card links to the queue, not a subject type, and shows a due
  // count rather than a completion percent.
  if (card.isReviewQueue) {
    const due = card.dueCount ?? 0;
    return (
      <Link
        href="/reviews"
        className="group relative flex min-w-[76vw] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-card)] border border-line p-4 min-h-[190px] transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-line-strong sm:min-w-0"
        style={{
          background: `linear-gradient(160deg, color-mix(in oklch, ${accent} 16%, var(--color-surface)), var(--color-surface))`,
        }}
      >
        <div className="relative flex items-start justify-between">
          <span className="text-caption font-semibold text-text" lang="ja">
            {card.labelJa}
          </span>
          <span aria-hidden className="text-text-faint">
            ⤢
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <span className="text-glyph-sm" aria-hidden style={{ color: accent }}>
            {card.glyph}
          </span>
        </div>

        <div className="relative flex flex-col gap-1.5">
          <span className="text-h2 font-semibold tabular-nums text-text" lang="en">
            {due}
          </span>
          <span className="text-micro text-text-faint" lang="en">
            {due === 0 ? "Nothing due" : due === 1 ? "item due" : "items due"}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/subjects/${typeToSlug(card.type)}`}
      className="group relative flex min-w-[76vw] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-card)] border border-line p-4 min-h-[190px] transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-line-strong sm:min-w-0"
      style={{
        background: `linear-gradient(160deg, color-mix(in oklch, ${accent} 16%, var(--color-surface)), var(--color-surface))`,
      }}
    >
      {/* Ambient CTA glow: this is the most reachable "next action" card for
          a level-1 account with unlearned items, so it gets the breathing
          brand glow that the rank-gated glow rule otherwise never triggers. */}
      {isPrimaryCta && <div className="cta-glow-layer" aria-hidden />}

      <div className="relative flex items-start justify-between">
        <div className="flex flex-col leading-tight">
          <span className="text-caption font-semibold text-text" lang="ja">
            {card.labelJa}
          </span>
        </div>
        <span aria-hidden className="text-text-faint">
          ⤢
        </span>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <span className="text-glyph-sm" aria-hidden style={{ color: accent }}>
          {card.glyph}
        </span>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-micro text-text-faint" lang="en">
            {card.lessonNumber ? `Lesson ${card.lessonNumber}` : "はじめる"}
          </span>
          {card.percent !== null && (
            <span className="text-caption font-semibold tabular-nums text-text" lang="en">
              {displayedPercent}%
            </span>
          )}
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn("progress-sweep h-full rounded-full")}
            style={{ width: `${Math.max(sweptFraction * 100, sweptFraction > 0 ? 0 : 1.5)}%`, background: accent }}
          />
        </div>
      </div>
    </Link>
  );
}
