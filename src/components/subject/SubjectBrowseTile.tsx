import Link from "next/link";
import { SUBJECT_THEME } from "./theme";
import { typeToSlug } from "./typeSlug";
import { SrsStageChip } from "@/components/srs/SrsStageChip";
import type { SubjectListItem } from "@/server/queries/subjects";
import { cn } from "@/lib/utils";

/// Sentences and grammar patterns are multi-character strings — the shared
/// `subject-glyph` size (6rem) is sized for a single radical/kanji/vocab
/// glyph and would badly overflow either, so tiles clamp them to a smaller,
/// readable size instead of the full glyph treatment.
function TileGlyph({ type, characters, color }: { type: SubjectListItem["type"]; characters: string; color: string }) {
  if (type === "SENTENCE") {
    return (
      <span lang="ja" className="line-clamp-2 text-center text-caption" style={{ color }}>
        {characters}
      </span>
    );
  }
  if (type === "GRAMMAR") {
    return (
      <span lang="ja" className="line-clamp-2 text-center text-body font-semibold" style={{ color }}>
        {characters}
      </span>
    );
  }
  return (
    <span lang="ja" className="subject-glyph text-h2" style={{ color }}>
      {characters}
    </span>
  );
}

export interface SubjectBrowseTileProps {
  item: SubjectListItem;
  className?: string;
}

/// One tile in the `/subjects/[type]` browse grid. Four visually distinct
/// states: burned (terminal, muted gold), in-SRS (SrsStageChip), unlocked
/// not-started (normal opacity + "ready" dot), locked (dimmed, unlock
/// reason on hover/focus via title + a details popover for keyboard users).
export function SubjectBrowseTile({ item, className }: SubjectBrowseTileProps) {
  const theme = SUBJECT_THEME[item.type];
  const href = `/subjects/${typeToSlug(item.type)}/${item.slug}`;

  if (item.state === "locked") {
    const reason =
      item.lockedOn.length > 0
        ? `Requires ${item.lockedOn.map((l) => l.characters ?? l.slug).join(", ")} at Guru`
        : "Locked";
    return (
      <div
        tabIndex={0}
        title={reason}
        aria-label={`${item.characters ?? item.slug}, locked. ${reason}`}
        className={cn(
          "group relative flex flex-col items-center gap-1 rounded-[var(--radius-tile)] border border-line bg-surface-2 px-2 py-3 opacity-40",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] focus-visible:opacity-70",
          className,
        )}
      >
        <span aria-hidden className="absolute right-1.5 top-1.5 text-micro text-text-faint">
          🔒
        </span>
        <TileGlyph type={item.type} characters={item.characters ?? item.slug} color="var(--color-text-faint)" />
        <span className="line-clamp-1 text-micro text-text-faint">{item.meaning ?? item.slug}</span>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-[var(--radius-chip)] border border-line-strong bg-surface-3 px-2.5 py-1.5 text-micro text-text opacity-0 shadow-lg transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {reason}
        </span>
      </div>
    );
  }

  if (item.state === "burned") {
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-col items-center gap-1 rounded-[var(--radius-tile)] border px-2 py-3 transition-colors duration-[var(--duration-fast)]",
          "border-[color-mix(in_oklch,var(--color-rank-gold)_45%,var(--color-line))] bg-[color-mix(in_oklch,var(--color-rank-gold)_10%,var(--color-surface))]",
          "hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
          className,
        )}
      >
        <span aria-hidden className="text-micro" style={{ color: "var(--color-rank-gold)" }}>
          ✓ Burned
        </span>
        <TileGlyph type={item.type} characters={item.characters ?? item.slug} color={theme.text} />
        <span className="line-clamp-1 text-micro text-text-dim">{item.meaning ?? item.slug}</span>
      </Link>
    );
  }

  if (item.state === "learning") {
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-[var(--radius-tile)] border border-line bg-surface px-2 py-3 transition-colors duration-[var(--duration-fast)]",
          "hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
          className,
        )}
      >
        <TileGlyph type={item.type} characters={item.characters ?? item.slug} color={theme.text} />
        <span className="line-clamp-1 text-micro text-text-dim">{item.meaning ?? item.slug}</span>
        {item.srsStage !== null && <SrsStageChip stage={item.srsStage} className="h-5 px-1.5 text-[10px]" />}
      </Link>
    );
  }

  // not-started: unlocked, available to learn.
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col items-center gap-1 rounded-[var(--radius-tile)] border border-line bg-surface px-2 py-3 transition-colors duration-[var(--duration-fast)]",
        "hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
        style={{ background: theme.base }}
        title="Ready to learn"
      />
      <TileGlyph type={item.type} characters={item.characters ?? item.slug} color={theme.text} />
      <span className="line-clamp-1 text-micro text-text-dim">{item.meaning ?? item.slug}</span>
    </Link>
  );
}
