import { cn } from "@/lib/utils";

export interface PanelProps {
  /// Accent color driving the top hairline and header rail tint — typically
  /// a `SUBJECT_THEME[type].base` value or `var(--color-brand)`.
  accent: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  /// Optional Japanese sublabel shown under the title in the header rail.
  titleJa?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  /// Renders a skeleton at the same populated height instead of children.
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/// The recurring dashboard card shell: 2px accent hairline, gradient header
/// rail, and a body meant to hold `InsetPanel`s for density. `--accent` is
/// scoped locally from the `accent` prop so header-rail gradients and glow
/// can reference it without prop drilling.
export function Panel({
  accent,
  icon,
  title,
  titleJa,
  action,
  footer,
  loading = false,
  children,
  className,
}: PanelProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface",
        "shadow-[0_1px_0_0_oklch(1_0_0/0.045)_inset,0_8px_24px_-12px_oklch(0_0_0/0.7)]",
        "transition-[border-color,box-shadow] duration-[var(--duration-fast)]",
        "hover:border-line-strong hover:shadow-[0_1px_0_0_oklch(1_0_0/0.045)_inset,0_10px_28px_-12px_oklch(0_0_0/0.7)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
        className,
      )}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      {/* 2px accent hairline, full bleed */}
      <div className="h-[2px] w-full" style={{ background: "var(--accent)", opacity: 0.9 }} />

      {/* Header rail */}
      <div
        className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-3 [@supports_not_(color:color-mix(in_oklch,red,red))]:bg-surface-2"
        style={{
          background:
            "linear-gradient(to right, color-mix(in oklch, var(--accent) 14%, var(--color-surface-2)), var(--color-surface-2))",
        }}
      >
        {icon && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px]"
            style={{
              background: "color-mix(in oklch, var(--accent) 22%, transparent)",
              color: "var(--accent)",
            }}
          >
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-col justify-center leading-tight">
          <span className="truncate text-h3 font-semibold text-text">{title}</span>
          {titleJa && (
            <span lang="ja" className="truncate text-micro text-text-dim">
              {titleJa}
            </span>
          )}
        </div>
        {action && (
          <div className="ml-auto flex shrink-0 items-center">
            <span className="inline-flex h-7 items-center rounded-[var(--radius-chip)] px-2.5 text-caption text-text-dim transition-colors duration-[var(--duration-fast)] hover:bg-surface-3 hover:text-text">
              {action}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      {loading ? <PanelSkeleton /> : <div className="bg-surface p-4">{children}</div>}

      {footer && <div className="border-t border-line bg-surface-2 px-4 py-3">{footer}</div>}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 bg-surface p-4" aria-hidden>
      <div className="h-24 animate-pulse rounded-[var(--radius-tile)] bg-surface-2" />
      <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-2" />
      <div className="h-16 animate-pulse rounded-[var(--radius-tile)] bg-surface-2" />
    </div>
  );
}

export interface PanelGlowProps {
  accent: string;
  className?: string;
  children?: React.ReactNode;
}

/// Opt-in glow wrapper — NOT the Panel default. Wrap a `Panel` to add the
/// accent-colored ring + soft bloom, e.g. for a freshly-leveled-up card.
export function PanelGlow({ accent, className, children }: PanelGlowProps) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)]", className)}
      style={
        {
          "--accent": accent,
          boxShadow:
            "0 0 0 1px color-mix(in oklch, var(--accent) 40%, transparent), 0 0 28px -6px color-mix(in oklch, var(--accent) 55%, transparent)",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

export interface InsetPanelProps {
  children?: React.ReactNode;
  className?: string;
}

/// Sub-panel used inside a `Panel` body for legends, stat rows, and metadata
/// blocks. This nesting is what creates perceived density.
export function InsetPanel({ children, className }: InsetPanelProps) {
  return (
    <div className={cn("rounded-[var(--radius-tile)] border border-line bg-surface-2 p-3", className)}>
      {children}
    </div>
  );
}
