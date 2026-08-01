import type { SubjectType } from "@/generated/prisma/enums";
import { SUBJECT_THEME } from "./theme";
import { SrsStageChip } from "@/components/srs/SrsStageChip";
import { cn } from "@/lib/utils";

export interface SubjectCardProps {
  type: SubjectType;
  characters: string;
  meaning: string;
  stage?: number;
  locked?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

/// A single subject tile (radical/kanji/vocab/etc). Elevation is
/// border-plus-tint: surface at rest, surface-2 + line-strong on hover/focus.
export function SubjectCard({
  type,
  characters,
  meaning,
  stage,
  locked = false,
  loading = false,
  onClick,
  className,
}: SubjectCardProps) {
  const theme = SUBJECT_THEME[type];

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-tile)] border border-line bg-surface p-4 h-28 animate-pulse",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-disabled={locked}
      className={cn(
        "group flex flex-col items-start gap-2 rounded-[var(--radius-tile)] border border-line bg-surface p-4 text-left transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        "hover:bg-surface-2 hover:border-line-strong focus-visible:bg-surface-2 focus-visible:border-line-strong",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
        locked && "opacity-50 cursor-not-allowed hover:bg-surface hover:border-line",
        className,
      )}
      style={{ ["--tile-accent" as string]: theme.base }}
    >
      <span
        lang="ja"
        className="subject-glyph text-glyph-sm"
        style={{ color: theme.text }}
      >
        {characters}
      </span>
      <span className="text-sub text-text-muted">{meaning}</span>
      <div className="flex w-full items-center justify-between">
        <span
          className="text-micro font-medium uppercase tracking-wide"
          style={{ color: theme.base }}
          lang="en"
        >
          {theme.labelEn}
        </span>
        {stage !== undefined && <SrsStageChip stage={stage} />}
      </div>
    </button>
  );
}
