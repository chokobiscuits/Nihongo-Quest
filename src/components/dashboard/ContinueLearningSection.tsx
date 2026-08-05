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
            index={index}
            accent={CARD_ACCENTS[index % CARD_ACCENTS.length]}
            // The first seeded, unlocked card is the primary CTA — it's the
            // one that gets the breathing glow, since it's the most likely
            // next action for an account with lessons actually available. A
            // seeded-but-locked type (below its type-unlock threshold)
            // never gets the glow even if it's earlier in the row.
            isPrimaryCta={index === cards.findIndex((c) => c.seeded && c.unlocked)}
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
  index,
}: {
  card: DashboardContinueCard;
  accent: string;
  isPrimaryCta: boolean;
  index: number;
}) {
  // Drives the staggered entrance so the row cascades in rather than
  // appearing as one block.
  const entranceStyle = { "--entrance-index": index } as React.CSSProperties;
  // Hooks run unconditionally regardless of `card.seeded` — the unseeded
  // early-return branch below just never reads their output.
  const percent = card.percent ?? 0;
  const displayedPercent = useCountUp(percent);
  const sweptFraction = useMountedFraction(percent / 100, 80);

  if (!card.seeded) {
    return (
      <div
        className="entrance-staggered flex min-w-[76vw] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-4 min-h-[190px] sm:min-w-0"
        style={{ "--accent": accent, ...entranceStyle } as React.CSSProperties}
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
        className="card-lift entrance-staggered group relative flex min-w-[76vw] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-card)] border border-line p-4 min-h-[190px] hover:border-line-strong sm:min-w-0"
        style={{
          background: `linear-gradient(160deg, color-mix(in oklch, ${accent} 16%, var(--color-surface)), var(--color-surface))`,
          ...entranceStyle,
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

  // Locked (type-unlock gate not yet met): still a real, browsable type —
  // shown distinctly from the unseeded "Coming soon" cards above, with the
  // unlock requirement and progress in place of a completion percent.
  if (!card.unlocked) {
    const need = Math.max(card.need, 1);
    const lockedFraction = Math.min(1, card.have / need);
    return (
      <Link
        href={`/subjects/${typeToSlug(card.type)}`}
        title={card.requirement ?? undefined}
        className="card-lift entrance-staggered group relative flex min-w-[76vw] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-card)] border border-dashed border-line p-4 min-h-[190px] hover:border-line-strong sm:min-w-0"
        style={entranceStyle}
      >
        <div className="relative flex items-start justify-between">
          <span className="text-caption font-semibold text-text" lang="ja">
            {card.labelJa}
          </span>
          <span aria-hidden className="text-text-faint">
            🔒
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <span className="text-glyph-sm opacity-30" aria-hidden style={{ color: accent }}>
            {card.glyph}
          </span>
        </div>

        <div className="relative flex flex-col gap-1.5">
          <span className="text-micro text-text-faint" lang="en">
            {card.requirement}
          </span>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full opacity-50"
              style={{ width: `${Math.max(lockedFraction * 100, card.have > 0 ? 0 : 1.5)}%`, background: accent }}
            />
          </div>
          <span className="text-micro text-text-faint" lang="en">
            {card.have} of {card.need}
          </span>
        </div>
      </Link>
    );
  }

  // The card body starts a lesson for this type rather than opening the
  // browse page. It reads "Lesson N" with lesson progress, so a browse link
  // here was the single most misleading affordance on the dashboard —
  // /lessons was reachable only via "Study All". Browsing is still one click
  // away via the corner link and the sidebar.
  return (
    <div
      className="card-lift entrance-staggered group relative flex min-w-[76vw] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-card)] border border-line p-4 min-h-[190px] hover:border-line-strong has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[var(--color-focus)] sm:min-w-0"
      style={{
        background: `linear-gradient(160deg, color-mix(in oklch, ${accent} 16%, var(--color-surface)), var(--color-surface))`,
        ...entranceStyle,
      }}
    >
      {/* Ambient CTA glow: this is the most reachable "next action" card for
          a level-1 account with unlearned items, so it gets the breathing
          brand glow that the rank-gated glow rule otherwise never triggers. */}
      {isPrimaryCta && <div className="cta-glow-layer" aria-hidden />}

      {/* Full-card click target for the primary action. Z-order contract for
          this card: overlay z-10, corner browse link z-20, content unlayered
          below. The content wrappers are `relative` with z-index auto, which
          paints them above an earlier sibling at z-0 — that is what used to
          leave only the p-4 gutter clickable. */}
      <Link
        href={`/lessons?type=${typeToSlug(card.type)}`}
        aria-label={`Start a ${card.labelEn} lesson`}
        className="absolute inset-0 z-10"
      />

      <div className="relative flex items-start justify-between">
        <div className="flex flex-col leading-tight">
          <span className="text-caption font-semibold text-text" lang="ja">
            {card.labelJa}
          </span>
        </div>
        <Link
          href={`/subjects/${typeToSlug(card.type)}`}
          aria-label={`Browse ${card.labelEn}`}
          title={`Browse ${card.labelEn}`}
          className="relative z-20 -m-2 p-2 text-text-faint hover:text-text"
        >
          <span aria-hidden>⤢</span>
        </Link>
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
    </div>
  );
}
