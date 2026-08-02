import Link from "next/link";
import type { DashboardContinueCard } from "@/server/queries/dashboard";
import { cn } from "@/lib/utils";

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
          className="inline-flex h-9 items-center rounded-[var(--radius-chip)] bg-brand px-4 text-caption font-semibold text-text hover:bg-brand-hover transition-colors duration-[var(--duration-fast)]"
        >
          Study All
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-5">
        {cards.map((card, index) => (
          <ContinueLearningCard key={card.type} card={card} accent={CARD_ACCENTS[index % CARD_ACCENTS.length]} />
        ))}
      </div>
    </section>
  );
}

function ContinueLearningCard({
  card,
  accent,
}: {
  card: DashboardContinueCard;
  accent: string;
}) {
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

  const percent = card.percent ?? 0;

  return (
    <Link
      href={`/subjects/${card.type}`}
      className="group relative flex min-w-[76vw] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-card)] border border-line p-4 min-h-[190px] transition-[border-color,box-shadow] duration-[var(--duration-fast)] hover:border-line-strong sm:min-w-0"
      style={{
        background: `linear-gradient(160deg, color-mix(in oklch, ${accent} 16%, var(--color-surface)), var(--color-surface))`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col leading-tight">
          <span className="text-caption font-semibold text-text" lang="ja">
            {card.labelJa}
          </span>
        </div>
        <span aria-hidden className="text-text-faint">
          ⤢
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-glyph-sm" aria-hidden style={{ color: accent }}>
          {card.glyph}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-micro text-text-faint" lang="en">
            {card.lessonNumber ? `Lesson ${card.lessonNumber}` : "はじめる"}
          </span>
          {card.percent !== null && (
            <span className="text-caption font-semibold text-text" lang="en">
              {percent}%
            </span>
          )}
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn("h-full rounded-full transition-[width] duration-[var(--duration-base)]")}
            style={{ width: `${percent}%`, background: accent }}
          />
        </div>
      </div>
    </Link>
  );
}
