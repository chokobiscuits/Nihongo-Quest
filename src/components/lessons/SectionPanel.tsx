import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionPanelProps {
  label: string;
  count?: number;
  /// Overrides the plain numeric count display, e.g. "20 of 989" when a
  /// list has been capped.
  countLabel?: string;
  labelColor?: string;
  children: ReactNode;
  className?: string;
}

/// Shared body-zone panel shell: label + optional right-aligned count above
/// content, on the `surface-2` tile background. Used for readings,
/// components, and (for vocab/kanji) the extra panels.
export function SectionPanel({ label, count, countLabel, labelColor, children, className }: SectionPanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[var(--radius-tile)] border border-line bg-surface-2 px-4 py-3.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-micro font-semibold uppercase tracking-[0.08em]"
          style={{ color: labelColor ?? "var(--color-text-dim)" }}
          lang="en"
        >
          {label}
        </span>
        {countLabel !== undefined ? (
          <span className="text-micro text-text-faint">{countLabel}</span>
        ) : (
          count !== undefined && <span className="text-micro text-text-faint">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}
