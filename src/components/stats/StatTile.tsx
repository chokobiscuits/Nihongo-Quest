import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  labelJa?: string;
  value: string | number;
  hint?: string;
  loading?: boolean;
  className?: string;
}

/// Small stat display used on the dashboard / right rail. Border-plus-tint
/// elevation, no shadows.
export function StatTile({ label, labelJa, value, hint, loading = false, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[var(--radius-tile)] border border-line bg-surface p-4",
        className,
      )}
    >
      <span className="text-caption text-text-dim" lang="en">
        {label}
        {labelJa && (
          <span lang="ja" className="ml-1 text-text-faint">
            {labelJa}
          </span>
        )}
      </span>
      {loading ? (
        <span className="h-7 w-16 rounded-[var(--radius-input)] bg-surface-2 animate-pulse" aria-hidden />
      ) : (
        <span className="text-h1 font-semibold text-text">{value}</span>
      )}
      {hint && <span className="text-micro text-text-faint">{hint}</span>}
    </div>
  );
}
