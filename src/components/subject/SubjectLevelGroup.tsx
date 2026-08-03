import Link from "next/link";
import type { SubjectListItem } from "@/server/queries/subjects";
import { SubjectBrowseTile } from "./SubjectBrowseTile";

export interface SubjectLevelGroupProps {
  level: number | null;
  /// Only populated when `open` — a collapsed group ships no tiles at all.
  items: SubjectListItem[];
  /// Total in this level, used for the count on collapsed groups where
  /// `items` is deliberately empty.
  count: number;
  open: boolean;
  /// Href that expands this group (or collapses it, when already open).
  toggleHref: string;
}

/// One curriculum-level section in the browse list.
///
/// Deliberately NOT a <details> element: a closed <details> still ships its
/// children in the HTML, and with ~90 vocab per level over a 10-level window
/// that pushed /subjects/vocabulary to 1.8MB. Collapsed groups are links that
/// re-request the page with that level open, so exactly one level's tiles are
/// ever in the payload.
export function SubjectLevelGroup({ level, items, count, open, toggleHref }: SubjectLevelGroupProps) {
  const label = level === null ? "Additional" : `Level ${level}`;
  const labelJa = level === null ? "その他" : undefined;

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface">
      <Link
        href={toggleHref}
        scroll={false}
        aria-expanded={open}
        className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] px-4 py-3 transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`text-text-dim transition-transform duration-[var(--duration-fast)] ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <span className="text-body font-semibold text-text" lang="en">
            {label}
          </span>
          {labelJa && (
            <span lang="ja" className="text-caption text-text-faint">
              {labelJa}
            </span>
          )}
        </span>
        <span className="text-micro text-text-faint" lang="en">
          {count}
        </span>
      </Link>

      {open && items.length > 0 && (
        <div className="grid grid-cols-4 gap-2 border-t border-line p-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {items.map((item) => (
            <SubjectBrowseTile key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
